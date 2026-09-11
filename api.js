module.exports = {
  async getHealth({ homey }) {
    return homey.app.getHealth();
  },
  async getMarketplaces({ homey }) {
    return homey.app.getMarketplaces();
  },
  async getProviders({ homey }) {
    return homey.app.getProviders();
  },
  async reloadProviders({ homey }) {
    return homey.app.reloadProviders();
  },
  async testAmazonCreators({ homey, body }) {
    return homey.app.testAmazonCreators(body);
  },
  async getAccountConnectors({ homey }) {
    return homey.app.getAccountConnectors();
  },
  async getAccounts({ homey }) {
    return homey.app.getAccounts();
  },
  async createAccount({ homey, body }) {
    return homey.app.createAccount(body);
  },
  async updateAccount({ homey, params, body }) {
    return homey.app.updateAccount(params.id, body);
  },
  async removeAccount({ homey, params }) {
    return homey.app.removeAccount(params.id);
  },
  async getLists({ homey }) {
    return homey.app.getLists();
  },
  async createList({ homey, body }) {
    return homey.app.createList(body);
  },
  async getList({ homey, params }) {
    return homey.app.getList(params.id);
  },
  async addListItem({ homey, params, body }) {
    return homey.app.addListItem(params.id, body);
  },
  async updateListItem({ homey, params, body }) {
    return homey.app.updateListItem(params.id, params.itemId, body);
  },
  async removeListItem({ homey, params }) {
    return homey.app.removeListItem(params.id, params.itemId);
  },
  async getProducts({ homey }) {
    return homey.app.getProducts();
  },
  async searchProducts({ homey, body }) {
    return homey.app.searchProducts(body);
  },
  async refreshProduct({ homey, params }) {
    return homey.app.refreshProduct(params.id);
  },
  async observeProduct({ homey, params, body }) {
    return homey.app.observeProduct(params.id, body);
  },
  async getShipments({ homey }) {
    return homey.app.getShipments();
  },
  async addShipment({ homey, body }) {
    return homey.app.addShipment(body);
  },
  async updateShipment({ homey, params, body }) {
    return homey.app.updateShipment(params.id, body);
  },
};
