const ProductProvider = require('./base');

/**
 * Placeholder for Amazon Creators API.
 *
 * Deliberately disabled until official credentials and a compliant Associates
 * configuration are supplied. Never accept Amazon retail account credentials.
 */
class AmazonCreatorsProvider extends ProductProvider {
  get id() {
    return 'amazon-creators';
  }

  get capabilities() {
    return {
      search: true,
      lookup: true,
      price: true,
      availability: true,
      accountLists: false,
      orders: false,
      checkout: false,
    };
  }

  async search() {
    throw new Error('Amazon Creators API is not configured yet.');
  }

  async lookup() {
    throw new Error('Amazon Creators API is not configured yet.');
  }
}

module.exports = AmazonCreatorsProvider;
