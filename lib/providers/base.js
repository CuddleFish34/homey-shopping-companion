class ProductProvider {
  constructor(options = {}) {
    this.options = options;
  }

  get id() {
    throw new Error('Provider id is required.');
  }

  get capabilities() {
    return {
      search: false,
      lookup: false,
      price: false,
      availability: false,
      accountLists: false,
      orders: false,
      checkout: false,
    };
  }

  async search() {
    throw new Error(`${this.id} does not support search.`);
  }

  async lookup() {
    throw new Error(`${this.id} does not support lookup.`);
  }
}

module.exports = ProductProvider;
