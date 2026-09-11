const assert = require('assert');
const { Store, extractAsin } = require('../lib/store');
const ProviderRegistry = require('../lib/providers/registry');
const AccountConnector = require('../lib/account-connectors/base');
const AccountConnectorRegistry = require('../lib/account-connectors/registry');

class Settings {
  constructor() { this.values = new Map(); }
  get(key) { return this.values.get(key); }
  async set(key, value) { this.values.set(key, JSON.parse(JSON.stringify(value))); }
}

async function main() {
  assert.strictEqual(
    extractAsin('https://www.amazon.se/dp/B0ABC12345?th=1'),
    'B0ABC12345'
  );

  const homey = { settings: new Settings() };
  const store = new Store(homey);
  await store.init();
  const account = await store.createAccount({ name: 'Sweden profile', marketplace: 'SE' });
  const list = await store.createList({ name: 'Test', accountId: account.id });
  assert.strictEqual(list.marketplace, 'SE');
  assert.strictEqual(list.accountId, account.id);
  const item = await store.addListItem(list.id, {
    url: 'https://www.amazon.se/dp/B0ABC12345',
    title: 'Test product',
    quantity: 2,
    price: 99,
  });
  assert.strictEqual(item.quantity, 2);
  assert.strictEqual(store.getProducts()[0].currency, 'SEK');

  const providers = new ProviderRegistry();
  assert.strictEqual(providers.get('manual').capabilities.checkout, false);

  class UnsafeConnector extends AccountConnector {
    get id() { return 'unsafe'; }
    get capabilities() {
      return { ...super.capabilities, checkout: true };
    }
  }
  const accounts = new AccountConnectorRegistry();
  assert.throws(() => accounts.register(new UnsafeConnector()));

  console.log('Amazon Companion smoke tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
