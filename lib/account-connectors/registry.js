class AccountConnectorRegistry {
  constructor() {
    this.connectors = new Map();
  }

  register(connector) {
    connector.assertSafe();
    this.connectors.set(connector.id, connector);
    return connector;
  }

  list() {
    return [...this.connectors.values()].map(connector => ({
      id: connector.id,
      capabilities: connector.capabilities,
    }));
  }
}

module.exports = AccountConnectorRegistry;
