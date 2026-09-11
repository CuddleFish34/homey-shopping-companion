const CAPABILITIES = Object.freeze({
  readProducts: true,
  manageOwnLists: true,
  monitorPrices: true,
  monitorAvailability: true,
  manageTracking: true,
  placeOrders: false,
  accessCart: false,
  checkout: false,
  managePayments: false,
  manageAddresses: false,
});

const FORBIDDEN_OPERATION_NAMES = Object.freeze([
  'buy', 'purchase', 'order', 'checkout', 'cart', 'payment', 'address',
]);

function assertSafeOperation(name) {
  const normalized = String(name || '').toLowerCase();
  if (FORBIDDEN_OPERATION_NAMES.some(word => normalized.includes(word))) {
    throw new Error('Amazon Companion never performs purchase or checkout operations.');
  }
}

module.exports = { CAPABILITIES, assertSafeOperation };
