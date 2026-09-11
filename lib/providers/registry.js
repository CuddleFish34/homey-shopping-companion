const ManualProvider = require('./manual');
const AmazonCreatorsProvider = require('./amazon-creators');

class ProviderRegistry {
  constructor(options = {}) {
    this.providers = new Map();
    this.register(new ManualProvider(options.manual));
    this.register(new AmazonCreatorsProvider(options.amazonCreators || {}));
  }

  register(provider) {
    if (!provider || !provider.id) throw new Error('Invalid provider.');
    if (provider.capabilities.checkout) {
      throw new Error('Providers with checkout capability are forbidden.');
    }
    this.providers.set(provider.id, provider);
    return provider;
  }

  get(id = 'manual') {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
  }

  list() {
    return [...this.providers.values()].map(provider => ({
      id: provider.id,
      configured: provider.configured !== undefined ? provider.configured : true,
      capabilities: provider.capabilities,
    }));
  }
}

module.exports = ProviderRegistry;
