const ProductProvider = require('./base');

class ManualProvider extends ProductProvider {
  get id() {
    return 'manual';
  }

  get capabilities() {
    return {
      search: false,
      lookup: true,
      price: false,
      availability: false,
      accountLists: false,
      orders: false,
      checkout: false,
    };
  }

  async lookup(input = {}) {
    return {
      asin: input.asin || null,
      url: input.url || null,
      title: input.title || input.asin || 'Amazon product',
      price: input.price ?? null,
      currency: input.currency || null,
      availability: input.availability || 'unknown',
      source: this.id,
    };
  }
}

module.exports = ManualProvider;
