class AccountConnector {
  get id() {
    throw new Error('Account connector id is required.');
  }

  get capabilities() {
    return {
      profileRead: false,
      shoppingListsRead: false,
      shoppingListsWrite: false,
      ordersRead: false,
      shipmentsRead: false,
      cartWrite: false,
      checkout: false,
      payments: false,
      addressesWrite: false,
    };
  }

  assertSafe() {
    const c = this.capabilities;
    if (c.cartWrite || c.checkout || c.payments || c.addressesWrite) {
      throw new Error('Unsafe Amazon account connector capability.');
    }
    return true;
  }
}

module.exports = AccountConnector;
