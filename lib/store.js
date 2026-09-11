const { randomUUID } = require('crypto');
const { getMarketplace } = require('./marketplaces');

function freshState() {
  return {
    schemaVersion: 2,
    preferences: {
      defaultMarketplace: 'SE',
      defaultAccountId: null,
      autoRemoveOnOrdered: false,
      autoRemoveOnDelivered: true,
    },
    accounts: [],
    lists: [],
    products: [],
    shipments: [],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function extractAsin(url = '') {
  const match = String(url).match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

class Store {
  constructor(homey) {
    this.homey = homey;
    this.state = freshState();
  }

  async init() {
    const saved = this.homey.settings.get('shopping_companion_state');
    if (saved && saved.schemaVersion === 2) {
      this.state = saved;
    } else if (saved && saved.schemaVersion === 1) {
      const defaults = freshState();
      this.state = {
        ...saved,
        schemaVersion: 2,
        accounts: saved.accounts || [],
        preferences: { ...defaults.preferences, ...saved.preferences },
      };
    } else {
      this.state = freshState();
    }
    await this.save();
  }

  async save() {
    await this.homey.settings.set('shopping_companion_state', this.state);
  }

  snapshot() {
    return clone(this.state);
  }

  getPreferences() {
    return clone(this.state.preferences);
  }

  async setPreferences(patch = {}) {
    this.state.preferences = { ...this.state.preferences, ...patch };
    await this.save();
    return this.getPreferences();
  }

  getAccounts() {
    return clone(this.state.accounts);
  }

  getAccount(id) {
    const account = this.state.accounts.find(item => item.id === id);
    if (!account) throw new Error('Amazon account profile not found.');
    return clone(account);
  }

  async createAccount({ name, marketplace } = {}) {
    if (!name || !String(name).trim()) throw new Error('Account profile name is required.');
    const market = String(marketplace || this.state.preferences.defaultMarketplace).toUpperCase();
    getMarketplace(market);
    const account = {
      id: randomUUID(),
      name: String(name).trim(),
      marketplace: market,
      connection: { connectorId: null, status: 'local_only' },
      createdAt: new Date().toISOString(),
    };
    this.state.accounts.push(account);
    if (!this.state.preferences.defaultAccountId) this.state.preferences.defaultAccountId = account.id;
    await this.save();
    return clone(account);
  }

  async updateAccount(id, patch = {}) {
    const account = this.state.accounts.find(item => item.id === id);
    if (!account) throw new Error('Amazon account profile not found.');
    if (patch.name) account.name = String(patch.name).trim();
    if (patch.marketplace) {
      const market = String(patch.marketplace).toUpperCase();
      getMarketplace(market);
      account.marketplace = market;
    }
    account.updatedAt = new Date().toISOString();
    await this.save();
    return clone(account);
  }

  async removeAccount(id) {
    if (this.state.lists.some(list => list.accountId === id)) {
      throw new Error('Account profile is still used by a shopping list.');
    }
    const index = this.state.accounts.findIndex(item => item.id === id);
    if (index < 0) throw new Error('Amazon account profile not found.');
    const [removed] = this.state.accounts.splice(index, 1);
    if (this.state.preferences.defaultAccountId === id) {
      this.state.preferences.defaultAccountId = this.state.accounts[0]?.id || null;
    }
    await this.save();
    return clone(removed);
  }

  getLists() {
    return clone(this.state.lists);
  }

  getList(id) {
    const list = this.state.lists.find(item => item.id === id);
    if (!list) throw new Error('Shopping list not found.');
    return clone(list);
  }

  async createList({ name, marketplace, accountId } = {}) {
    if (!name || !String(name).trim()) throw new Error('List name is required.');
    const account = accountId ? this.state.accounts.find(item => item.id === accountId) : null;
    if (accountId && !account) throw new Error('Amazon account profile not found.');
    const market = String(
      (account && account.marketplace) || marketplace || this.state.preferences.defaultMarketplace
    ).toUpperCase();
    getMarketplace(market);
    const list = {
      id: randomUUID(),
      name: String(name).trim(),
      marketplace: market,
      accountId: account ? account.id : null,
      createdAt: new Date().toISOString(),
      items: [],
    };
    this.state.lists.push(list);
    await this.save();
    return clone(list);
  }

  _findOrCreateProduct(input = {}, marketplaceCode) {
    const asin = (input.asin || extractAsin(input.url) || '').toUpperCase() || null;
    let product = asin
      ? this.state.products.find(p => p.asin === asin && p.marketplace === marketplaceCode)
      : null;
    if (!product && input.url) {
      product = this.state.products.find(p => p.url === input.url);
    }
    if (!product) {
      const market = getMarketplace(marketplaceCode);
      product = {
        id: randomUUID(),
        asin,
        url: input.url || (asin ? `https://${market.domain}/dp/${asin}` : null),
        title: input.title || asin || 'Amazon product',
        marketplace: marketplaceCode,
        currency: input.currency || market.currency,
        currentPrice: Number.isFinite(Number(input.price)) ? Number(input.price) : null,
        availability: input.availability || 'unknown',
        providerId: input.providerId || 'manual',
        watch: { enabled: input.watchEnabled !== false },
        createdAt: new Date().toISOString(),
        lastCheckedAt: null,
      };
      this.state.products.push(product);
    }
    return product;
  }

  async addListItem(listId, input = {}) {
    const list = this.state.lists.find(item => item.id === listId);
    if (!list) throw new Error('Shopping list not found.');
    const product = this._findOrCreateProduct(input, list.marketplace);
    const existing = list.items.find(item => item.productId === product.id);
    if (existing) {
      existing.quantity += Math.max(1, Number(input.quantity) || 1);
      await this.save();
      return clone(existing);
    }
    const item = {
      id: randomUUID(),
      productId: product.id,
      quantity: Math.max(1, Number(input.quantity) || 1),
      state: 'wanted',
      addedAt: new Date().toISOString(),
    };
    list.items.push(item);
    await this.save();
    return clone(item);
  }

  async updateListItem(listId, itemId, patch = {}) {
    const list = this.state.lists.find(item => item.id === listId);
    if (!list) throw new Error('Shopping list not found.');
    const item = list.items.find(entry => entry.id === itemId);
    if (!item) throw new Error('Shopping list item not found.');

    if (patch.quantity !== undefined) item.quantity = Math.max(1, Number(patch.quantity) || 1);
    if (patch.state) item.state = String(patch.state);
    item.updatedAt = new Date().toISOString();
    await this.save();
    return clone(item);
  }

  async removeListItem(listId, itemId) {
    const list = this.state.lists.find(item => item.id === listId);
    if (!list) throw new Error('Shopping list not found.');
    const index = list.items.findIndex(entry => entry.id === itemId);
    if (index < 0) throw new Error('Shopping list item not found.');
    const [removed] = list.items.splice(index, 1);
    await this.save();
    return clone(removed);
  }

  getProducts() {
    return clone(this.state.products);
  }

  getProduct(id) {
    const product = this.state.products.find(item => item.id === id);
    if (!product) throw new Error('Product not found.');
    return product;
  }

  async observeProduct(id, observation = {}) {
    const product = this.getProduct(id);
    const before = clone(product);
    if (observation.title) product.title = String(observation.title);
    if (observation.url) product.url = String(observation.url);
    if (observation.currency) product.currency = String(observation.currency);
    if (observation.price !== undefined && observation.price !== null) {
      product.currentPrice = Number(observation.price);
    }
    if (observation.availability) product.availability = String(observation.availability);
    product.lastCheckedAt = new Date().toISOString();
    await this.save();
    return { before, after: clone(product) };
  }

  getShipments() {
    return clone(this.state.shipments);
  }

  async addShipment(input = {}) {
    if (!input.trackingNumber) throw new Error('Tracking number is required.');
    const shipment = {
      id: randomUUID(),
      trackingNumber: String(input.trackingNumber),
      carrier: input.carrier || 'unknown',
      status: input.status || 'registered',
      orderReference: input.orderReference || null,
      linkedItems: Array.isArray(input.linkedItems) ? input.linkedItems : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.shipments.push(shipment);
    await this.save();
    return clone(shipment);
  }

  async updateShipment(id, patch = {}) {
    const shipment = this.state.shipments.find(item => item.id === id);
    if (!shipment) throw new Error('Shipment not found.');
    const before = clone(shipment);
    if (patch.status) shipment.status = String(patch.status);
    if (patch.carrier) shipment.carrier = String(patch.carrier);
    if (patch.orderReference !== undefined) shipment.orderReference = patch.orderReference;
    if (Array.isArray(patch.linkedItems)) shipment.linkedItems = patch.linkedItems;
    shipment.updatedAt = new Date().toISOString();
    await this.save();
    return { before, after: clone(shipment) };
  }

  async removeLinkedItems(linkedItems = []) {
    const removed = [];
    for (const link of linkedItems) {
      const list = this.state.lists.find(entry => entry.id === link.listId);
      if (!list) continue;
      const index = list.items.findIndex(entry => entry.id === link.itemId);
      if (index >= 0) removed.push(list.items.splice(index, 1)[0]);
    }
    if (removed.length) await this.save();
    return clone(removed);
  }
}

module.exports = { Store, extractAsin, freshState };
