const { getMarketplace } = require('./marketplaces');

class ProductMonitor {
  constructor(app, options = {}) {
    this.app = app;
    this.intervalMinutes = Math.max(15, Number(options.intervalMinutes || 60));
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.timer) return;
    const intervalMs = this.intervalMinutes * 60 * 1000;
    this.timer = this.app.homey.setInterval(() => {
      this.run().catch(error => this.app.error('Product monitor failed', error));
    }, intervalMs);

    this.app.homey.setTimeout(() => {
      this.run().catch(error => this.app.error('Initial product monitor failed', error));
    }, 30000);
  }

  stop() {
    if (this.timer) this.app.homey.clearInterval(this.timer);
    this.timer = null;
  }

  async run() {
    if (this.running) return { skipped: 'already_running' };
    this.running = true;
    const summary = { checked: 0, skipped: 0, errors: [] };
    try {
      const now = Date.now();
      for (const product of this.app.store.getProducts()) {
        if (!product.watch || product.watch.enabled === false) {
          summary.skipped += 1;
          continue;
        }

        const providerId = product.providerId || 'manual';
        if (providerId === 'manual') {
          summary.skipped += 1;
          continue;
        }

        const last = product.lastCheckedAt ? Date.parse(product.lastCheckedAt) : 0;
        if (last && now - last < (this.intervalMinutes - 2) * 60 * 1000) {
          summary.skipped += 1;
          continue;
        }

        try {
          const provider = this.app.providers.get(providerId);
          if (provider.configured === false) {
            summary.skipped += 1;
            continue;
          }
          const market = getMarketplace(product.marketplace);
          const observation = await provider.lookup({
            ...product,
            marketplaceDomain: market.domain,
          });
          await this.app.observeProduct(product.id, observation);
          summary.checked += 1;
        } catch (error) {
          summary.errors.push({ productId: product.id, message: error.message });
        }
      }
      return summary;
    } finally {
      this.running = false;
    }
  }
}

module.exports = ProductMonitor;
