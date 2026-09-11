const ProductProvider = require('./base');

const TOKEN_ENDPOINTS = Object.freeze({
  '3.1': 'https://api.amazon.com/auth/o2/token',
  '3.2': 'https://api.amazon.co.uk/auth/o2/token',
  '3.3': 'https://api.amazon.co.jp/auth/o2/token',
});

function normalizeAvailability(value) {
  const v = String(value || '').replace(/_/g, '').toUpperCase();
  if (v === 'INSTOCK' || v === 'INSTOCKSCARCE') return 'in_stock';
  if (v === 'OUTOFSTOCK') return 'out_of_stock';
  if (v === 'UNAVAILABLE') return 'unavailable';
  if (v === 'PREORDER') return 'preorder';
  return 'unknown';
}

class AmazonCreatorsProvider extends ProductProvider {
  constructor(options = {}) {
    super(options);
    this.enabled = options.enabled === true;
    this.credentialId = options.credentialId || '';
    this.credentialSecret = options.credentialSecret || '';
    this.credentialVersion = options.credentialVersion || '3.2';
    this.partnerTags = options.partnerTags || {};
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  get id() {
    return 'amazon-creators';
  }

  get configured() {
    return Boolean(
      this.enabled &&
      this.credentialId &&
      this.credentialSecret &&
      TOKEN_ENDPOINTS[this.credentialVersion]
    );
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

  _partnerTagFor(marketplace) {
    const tag = this.partnerTags[marketplace];
    if (!tag) throw new Error(`No Amazon Partner Tag configured for ${marketplace}.`);
    return tag;
  }

  async _getToken() {
    if (!this.configured) throw new Error('Amazon Creators API credentials are not configured.');
    if (this._token && Date.now() < this._tokenExpiresAt - 60000) return this._token;

    const response = await fetch(TOKEN_ENDPOINTS[this.credentialVersion], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.credentialId,
        client_secret: this.credentialSecret,
        scope: 'creatorsapi::default',
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Amazon token request failed (${response.status}): ${text.slice(0, 180)}`);
    }
    const data = await response.json();
    this._token = data.access_token;
    this._tokenExpiresAt = Date.now() + (Number(data.expires_in || 3600) * 1000);
    return this._token;
  }

  async _request(path, marketplace, body) {
    const token = await this._getToken();
    const response = await fetch(`https://creatorsapi.amazon${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-marketplace': marketplace,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Amazon Creators API failed (${response.status}): ${text.slice(0, 220)}`);
    }
    return response.json();
  }

  _mapItem(item, marketplace) {
    const listing = item.offersV2?.listings?.[0] || null;
    return {
      asin: item.asin || null,
      title: item.itemInfo?.title?.displayValue || item.asin || 'Amazon product',
      url: item.detailPageURL || null,
      marketplace,
      price: listing?.price?.money?.amount ?? null,
      currency: listing?.price?.money?.currency || null,
      availability: normalizeAvailability(listing?.availability?.type),
      source: this.id,
      rawAvailability: listing?.availability?.type || null,
    };
  }

  async lookup(input = {}) {
    if (!input.asin) throw new Error('ASIN is required.');
    if (!input.marketplaceDomain) throw new Error('Marketplace domain is required.');
    const partnerTag = input.partnerTag || this._partnerTagFor(input.marketplace);
    const result = await this._request('/catalog/v1/getItems', input.marketplaceDomain, {
      itemIds: [input.asin],
      itemIdType: 'ASIN',
      marketplace: input.marketplaceDomain,
      partnerTag,
      resources: [
        'itemInfo.title',
        'offersV2.listings.availability',
        'offersV2.listings.price',
      ],
    });
    const item = result.itemsResult?.items?.[0];
    if (!item) throw new Error('Amazon product not found.');
    return this._mapItem(item, input.marketplace);
  }

  async search(input = {}) {
    if (!input.keywords) throw new Error('Search keywords are required.');
    if (!input.marketplaceDomain) throw new Error('Marketplace domain is required.');
    const partnerTag = input.partnerTag || this._partnerTagFor(input.marketplace);
    const result = await this._request('/catalog/v1/searchItems', input.marketplaceDomain, {
      keywords: input.keywords,
      marketplace: input.marketplaceDomain,
      partnerTag,
      itemCount: Math.min(10, Math.max(1, Number(input.itemCount) || 10)),
      resources: [
        'itemInfo.title',
        'offersV2.listings.availability',
        'offersV2.listings.price',
      ],
    });
    const items = result.searchResult?.items || [];
    return items.map(item => this._mapItem(item, input.marketplace));
  }
}

module.exports = AmazonCreatorsProvider;
