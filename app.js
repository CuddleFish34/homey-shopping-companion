const Homey = require('homey');
const { Store } = require('./lib/store');
const { listMarketplaces } = require('./lib/marketplaces');
const { CAPABILITIES } = require('./lib/safety');
const ProviderRegistry = require('./lib/providers/registry');

class AmazonCompanionApp extends Homey.App {
  async onInit() {
    this.store = new Store(this.homey);
    await this.store.init();
    this.providers = new ProviderRegistry();
    this._registerFlowCards();
    this.log('Amazon Companion initialized in read/list-only mode.');
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
    this.homey.flow.getActionCard('add_product')
      .registerRunListener(args => this.addListItem(args.list_id, args));
    this.homey.flow.getActionCard('remove_product')
      .registerRunListener(args => this.removeListItem(args.list_id, args.item_id));
    this.homey.flow.getActionCard('mark_item_ordered')
      .registerRunListener(args => this.markItemOrdered(args.list_id, args.item_id));
    this.homey.flow.getActionCard('add_tracking')
      .registerRunListener(args => this.addShipment(args));
    this.homey.flow.getActionCard('set_shipment_status')
      .registerRunListener(args => this.updateShipment(args.shipment_id, { status: args.status }));
    this.homey.flow.getActionCard('record_product_observation')
      .registerRunListener(args => this.observeProduct(args.product_id, args));

    this.homey.flow.getConditionCard('product_in_stock')
      .registerRunListener(async args => this.store.getProduct(args.product_id).availability === 'in_stock');
    this.homey.flow.getConditionCard('product_price_below')
      .registerRunListener(async args => {
        const price = this.store.getProduct(args.product_id).currentPrice;
        return price !== null && price < Number(args.amount);
      });
    this.homey.flow.getConditionCard('list_contains_product')
      .registerRunListener(async args => {
        const list = this.store.getList(args.list_id);
        return list.items.some(item => item.productId === args.product_id);
      });
    this.homey.flow.getConditionCard('shipment_is_delivered')
      .registerRunListener(async args => {
        const shipment = this.store.getShipments().find(item => item.id === args.shipment_id);
        return Boolean(shipment && shipment.status === 'delivered');
      });
  }

  getHealth() {
    return {
      ok: true,
      app: 'Amazon Companion',
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

module.exports = AmazonCompanionApp;
