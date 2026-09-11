const Homey = require('homey');
const { Store } = require('./lib/store');
const { listMarketplaces } = require('./lib/marketplaces');
const { CAPABILITIES } = require('./lib/safety');
const ProviderRegistry = require('./lib/providers/registry');
const AccountConnectorRegistry = require('./lib/account-connectors/registry');
const ProductMonitor = require('./lib/monitor');
const { getMarketplace } = require('./lib/marketplaces');

class ShoppingCompanionApp extends Homey.App {
  async onInit() {
    this.store = new Store(this.homey);
    await this.store.init();
    const creatorsConfig = this.homey.settings.get('amazon_creators_config') || {};
    this.providers = new ProviderRegistry({ amazonCreators: creatorsConfig });
    this.accountConnectors = new AccountConnectorRegistry();
    this.monitor = new ProductMonitor(this, {
      intervalMinutes: creatorsConfig.monitorIntervalMinutes || 60,
    });
    this._registerFlowCards();
    this.monitor.start();
    this.log('Shopping Companion initialized in read/list-monitor mode.');
  }

  _argId(value) {
    if (value && typeof value === 'object' && value.id) return value.id;
    return value;
  }

  _filterAutocomplete(results, query = '') {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return results.slice(0, 50);
    return results.filter(result => (
      String(result.name || '').toLowerCase().includes(q)
      || String(result.description || '').toLowerCase().includes(q)
    )).slice(0, 50);
  }

  _listAutocomplete(query = '') {
    return this._filterAutocomplete(this.store.getLists().map(list => ({
      id: list.id,
      name: list.name,
      description: `${list.marketplace} · ${list.items.length} item(s)`,
    })), query);
  }

  _productAutocomplete(query = '') {
    return this._filterAutocomplete(this.store.getProducts().map(product => ({
      id: product.id,
      name: product.title,
      description: [product.marketplace, product.currentPrice != null ? `${product.currentPrice} ${product.currency || ''}`.trim() : null]
        .filter(Boolean).join(' · '),
    })), query);
  }

  _listItemAutocomplete(query = '', args = {}) {
    const listId = this._argId(args.list_id);
    if (!listId) return [];
    let list;
    try { list = this.store.getList(listId); } catch (error) { return []; }
    const results = list.items.map(item => {
      let product;
      try { product = this.store.getProduct(item.productId); } catch (error) { product = null; }
      return {
        id: item.id,
        productId: item.productId,
        name: product ? product.title : item.id,
        description: `${item.quantity}× · ${list.name}`,
      };
    });
    return this._filterAutocomplete(results, query);
  }

  _shipmentAutocomplete(query = '') {
    return this._filterAutocomplete(this.store.getShipments().map(shipment => ({
      id: shipment.id,
      name: shipment.trackingNumber,
      description: [shipment.carrier, shipment.status].filter(Boolean).join(' · '),
    })), query);
  }

  _registerFlowCards() {
    this.flow = {
      priceChanged: this.homey.flow.getTriggerCard('price_changed'),
      priceDroppedAmount: this.homey.flow.getTriggerCard('price_dropped_amount'),
      priceDroppedPercent: this.homey.flow.getTriggerCard('price_dropped_percent'),
      backInStock: this.homey.flow.getTriggerCard('back_in_stock'),
      outOfStock: this.homey.flow.getTriggerCard('out_of_stock'),
      productUnavailable: this.homey.flow.getTriggerCard('product_unavailable'),
      newTracking: this.homey.flow.getTriggerCard('new_tracking_number'),
      shipmentChanged: this.homey.flow.getTriggerCard('shipment_status_changed'),
      shipmentDelivered: this.homey.flow.getTriggerCard('shipment_delivered'),
      listItemAdded: this.homey.flow.getTriggerCard('list_item_added'),
    };

    this.flow.priceDroppedAmount.registerRunListener(async (args, state) => (
      Number(state.dropAmount || 0) >= Number(args.amount || 0)
    ));
    this.flow.priceDroppedPercent.registerRunListener(async (args, state) => (
      Number(state.dropPercent || 0) >= Number(args.percent || 0)
    ));

    this.homey.flow.getActionCard('create_list')
      .registerRunListener(args => this.createList(args));

    const addProductCard = this.homey.flow.getActionCard('add_product');
    addProductCard.registerArgumentAutocompleteListener('list_id', async query => this._listAutocomplete(query));
    addProductCard.registerRunListener(args => this.addListItem(this._argId(args.list_id), args));

    const removeProductCard = this.homey.flow.getActionCard('remove_product');
    removeProductCard.registerArgumentAutocompleteListener('list_id', async query => this._listAutocomplete(query));
    removeProductCard.registerArgumentAutocompleteListener('item_id', async (query, args) => this._listItemAutocomplete(query, args));
    removeProductCard.registerRunListener(args => this.removeListItem(
      this._argId(args.list_id),
      this._argId(args.item_id),
    ));

    const markOrderedCard = this.homey.flow.getActionCard('mark_item_ordered');
    markOrderedCard.registerArgumentAutocompleteListener('list_id', async query => this._listAutocomplete(query));
    markOrderedCard.registerArgumentAutocompleteListener('item_id', async (query, args) => this._listItemAutocomplete(query, args));
    markOrderedCard.registerRunListener(args => this.markItemOrdered(
      this._argId(args.list_id),
      this._argId(args.item_id),
    ));

    this.homey.flow.getActionCard('add_tracking')
      .registerRunListener(args => this.addShipment({
        trackingNumber: args.tracking_number,
        carrier: args.carrier,
        orderReference: args.order_reference,
      }));

    const setShipmentStatusCard = this.homey.flow.getActionCard('set_shipment_status');
    setShipmentStatusCard.registerArgumentAutocompleteListener('shipment_id', async query => this._shipmentAutocomplete(query));
    setShipmentStatusCard.registerRunListener(args => this.updateShipment(
      this._argId(args.shipment_id),
      { status: args.status },
    ));

    const recordObservationCard = this.homey.flow.getActionCard('record_product_observation');
    recordObservationCard.registerArgumentAutocompleteListener('product_id', async query => this._productAutocomplete(query));
    recordObservationCard.registerRunListener(args => this.observeProduct(this._argId(args.product_id), args));

    this.homey.flow.getActionCard('check_watched_products')
      .registerRunListener(() => this.monitor.run());

    const productInStockCard = this.homey.flow.getConditionCard('product_in_stock');
    productInStockCard.registerArgumentAutocompleteListener('product_id', async query => this._productAutocomplete(query));
    productInStockCard.registerRunListener(async args => (
      this.store.getProduct(this._argId(args.product_id)).availability === 'in_stock'
    ));

    const productPriceBelowCard = this.homey.flow.getConditionCard('product_price_below');
    productPriceBelowCard.registerArgumentAutocompleteListener('product_id', async query => this._productAutocomplete(query));
    productPriceBelowCard.registerRunListener(async args => {
      const price = this.store.getProduct(this._argId(args.product_id)).currentPrice;
      return price !== null && price < Number(args.amount);
    });

    const listContainsProductCard = this.homey.flow.getConditionCard('list_contains_product');
    listContainsProductCard.registerArgumentAutocompleteListener('list_id', async query => this._listAutocomplete(query));
    listContainsProductCard.registerArgumentAutocompleteListener('product_id', async query => this._productAutocomplete(query));
    listContainsProductCard.registerRunListener(async args => {
      const list = this.store.getList(this._argId(args.list_id));
      const productId = this._argId(args.product_id);
      return list.items.some(item => item.productId === productId);
    });

    const shipmentDeliveredCard = this.homey.flow.getConditionCard('shipment_is_delivered');
    shipmentDeliveredCard.registerArgumentAutocompleteListener('shipment_id', async query => this._shipmentAutocomplete(query));
    shipmentDeliveredCard.registerRunListener(async args => {
      const shipmentId = this._argId(args.shipment_id);
      const shipment = this.store.getShipments().find(item => item.id === shipmentId);
      return Boolean(shipment && shipment.status === 'delivered');
    });
  }

  getHealth() {
    return {
      ok: true,
      app: 'Shopping Companion',
      version: this.manifest.version,
      mode: 'read-list-monitor-only',
      capabilities: CAPABILITIES,
    };
  }

  getMarketplaces() {
    return listMarketplaces();
  }

  getProviders() {
    return this.providers.list();
  }

  runMonitor() {
    return this.monitor.run();
  }

  reloadProviders() {
    const creatorsConfig = this.homey.settings.get('amazon_creators_config') || {};
    this.providers = new ProviderRegistry({ amazonCreators: creatorsConfig });
    if (this.monitor) {
      this.monitor.stop();
      this.monitor.intervalMinutes = Math.max(15, Number(creatorsConfig.monitorIntervalMinutes || 60));
      this.monitor.start();
    }
    return this.getProviders();
  }

  getAccountConnectors() {
    return this.accountConnectors.list();
  }

  getAccounts() {
    return this.store.getAccounts();
  }

  createAccount(input) {
    return this.store.createAccount(input);
  }

  updateAccount(id, input) {
    return this.store.updateAccount(id, input);
  }

  removeAccount(id) {
    return this.store.removeAccount(id);
  }

  getLists() {
    return this.store.getLists();
  }

  getList(id) {
    return this.store.getList(id);
  }

  async createList(input) {
    return this.store.createList(input);
  }

  async addListItem(listId, input) {
    const item = await this.store.addListItem(listId, input);
    const list = this.store.getList(listId);
    const product = this.store.getProduct(item.productId);
    await this.flow.listItemAdded.trigger({
      list: list.name,
      product: product.title,
      quantity: item.quantity,
    });
    return { item, product };
  }

  async updateListItem(listId, itemId, patch) {
    return this.store.updateListItem(listId, itemId, patch);
  }

  async removeListItem(listId, itemId) {
    return this.store.removeListItem(listId, itemId);
  }

  getProducts() {
    return this.store.getProducts();
  }

  async searchProducts(input = {}) {
    const marketCode = String(input.marketplace || this.store.getPreferences().defaultMarketplace || 'SE').toUpperCase();
    const market = getMarketplace(marketCode);
    const provider = this.providers.get('amazon-creators');
    return provider.search({
      keywords: input.keywords,
      itemCount: input.itemCount,
      marketplace: marketCode,
      marketplaceDomain: market.domain,
    });
  }

  async refreshProduct(id) {
    const product = this.store.getProduct(id);
    const market = getMarketplace(product.marketplace);
    const provider = this.providers.get(product.providerId || 'manual');
    if (provider.id === 'manual') throw new Error('Manual products do not have a live data provider.');
    const observation = await provider.lookup({
      ...product,
      marketplaceDomain: market.domain,
    });
    return this.observeProduct(id, observation);
  }

  async testAmazonCreators(input = {}) {
    const marketCode = String(input.marketplace || this.store.getPreferences().defaultMarketplace || 'SE').toUpperCase();
    const market = getMarketplace(marketCode);
    const provider = this.providers.get('amazon-creators');
    const result = await provider.search({
      keywords: 'Amazon Basics',
      itemCount: 1,
      marketplace: marketCode,
      marketplaceDomain: market.domain,
    });
    return { ok: true, marketplace: marketCode, resultCount: result.length };
  }

  async observeProduct(id, observation) {
    const result = await this.store.observeProduct(id, observation);
    await this._emitProductEvents(result.before, result.after);
    return result.after;
  }

  async _emitProductEvents(before, after) {
    const oldPrice = Number(before.currentPrice);
    const newPrice = Number(after.currentPrice);
    if (Number.isFinite(oldPrice) && Number.isFinite(newPrice) && oldPrice !== newPrice) {
      const change = newPrice - oldPrice;
      const percent = oldPrice === 0 ? 0 : (change / oldPrice) * 100;
      await this.flow.priceChanged.trigger({
        product: after.title,
        old_price: oldPrice,
        new_price: newPrice,
        change_amount: change,
        change_percent: percent,
        currency: after.currency,
      });
      if (change < 0) {
        const dropAmount = Math.abs(change);
        const dropPercent = Math.abs(percent);
        await this.flow.priceDroppedAmount.trigger({
          product: after.title,
          drop_amount: dropAmount,
          new_price: newPrice,
          currency: after.currency,
        }, { dropAmount, productId: after.id });
        await this.flow.priceDroppedPercent.trigger({
          product: after.title,
          drop_percent: dropPercent,
          new_price: newPrice,
          currency: after.currency,
        }, { dropPercent, productId: after.id });
      }
    }

    if (before.availability !== after.availability) {
      const tokens = { product: after.title, url: after.url || '' };
      if (after.availability === 'in_stock') await this.flow.backInStock.trigger(tokens);
      if (after.availability === 'out_of_stock') await this.flow.outOfStock.trigger(tokens);
      if (after.availability === 'unavailable') await this.flow.productUnavailable.trigger(tokens);
    }
  }

  getShipments() {
    return this.store.getShipments();
  }

  async addShipment(input) {
    const shipment = await this.store.addShipment(input);
    await this.flow.newTracking.trigger({
      tracking_number: shipment.trackingNumber,
      carrier: shipment.carrier,
      order_reference: shipment.orderReference || '',
    });
    return shipment;
  }

  async updateShipment(id, patch) {
    const result = await this.store.updateShipment(id, patch);
    const { before, after } = result;
    if (before.status !== after.status) {
      await this.flow.shipmentChanged.trigger({
        tracking_number: after.trackingNumber,
        carrier: after.carrier,
        status: after.status,
      });
    }
    if (before.status !== 'delivered' && after.status === 'delivered') {
      await this.flow.shipmentDelivered.trigger({
        tracking_number: after.trackingNumber,
        carrier: after.carrier,
      });
      const prefs = this.store.getPreferences();
      if (prefs.autoRemoveOnDelivered) {
        await this.store.removeLinkedItems(after.linkedItems);
      }
    }
    return after;
  }

  async markItemOrdered(listId, itemId) {
    const item = await this.store.updateListItem(listId, itemId, { state: 'ordered' });
    const prefs = this.store.getPreferences();
    if (prefs.autoRemoveOnOrdered) await this.store.removeListItem(listId, itemId);
    return item;
  }
}

module.exports = ShoppingCompanionApp;
