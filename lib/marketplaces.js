const MARKETPLACES = Object.freeze({
  AU: { domain: 'www.amazon.com.au', currency: 'AUD', region: 'FE' },
  BE: { domain: 'www.amazon.com.be', currency: 'EUR', region: 'EU' },
  BR: { domain: 'www.amazon.com.br', currency: 'BRL', region: 'NA' },
  CA: { domain: 'www.amazon.ca', currency: 'CAD', region: 'NA' },
  DE: { domain: 'www.amazon.de', currency: 'EUR', region: 'EU' },
  EG: { domain: 'www.amazon.eg', currency: 'EGP', region: 'EU' },
  ES: { domain: 'www.amazon.es', currency: 'EUR', region: 'EU' },
  FR: { domain: 'www.amazon.fr', currency: 'EUR', region: 'EU' },
  IE: { domain: 'www.amazon.ie', currency: 'EUR', region: 'EU' },
  IN: { domain: 'www.amazon.in', currency: 'INR', region: 'EU' },
  IT: { domain: 'www.amazon.it', currency: 'EUR', region: 'EU' },
  JP: { domain: 'www.amazon.co.jp', currency: 'JPY', region: 'FE' },
  MX: { domain: 'www.amazon.com.mx', currency: 'MXN', region: 'NA' },
  NL: { domain: 'www.amazon.nl', currency: 'EUR', region: 'EU' },
  PL: { domain: 'www.amazon.pl', currency: 'PLN', region: 'EU' },
  SA: { domain: 'www.amazon.sa', currency: 'SAR', region: 'EU' },
  SE: { domain: 'www.amazon.se', currency: 'SEK', region: 'EU' },
  SG: { domain: 'www.amazon.sg', currency: 'SGD', region: 'FE' },
  TR: { domain: 'www.amazon.com.tr', currency: 'TRY', region: 'EU' },
  AE: { domain: 'www.amazon.ae', currency: 'AED', region: 'EU' },
  UK: { domain: 'www.amazon.co.uk', currency: 'GBP', region: 'EU' },
  US: { domain: 'www.amazon.com', currency: 'USD', region: 'NA' },
});

function listMarketplaces() {
  return Object.entries(MARKETPLACES).map(([code, value]) => ({ code, ...value }));
}

function getMarketplace(code = 'SE') {
  return MARKETPLACES[String(code).toUpperCase()] || MARKETPLACES.SE;
}

module.exports = { MARKETPLACES, listMarketplaces, getMarketplace };
