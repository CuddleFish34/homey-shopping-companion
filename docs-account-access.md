# Amazon account access policy

Shopping Companion is designed to support optional Amazon account connections
only when Amazon provides an official API with sufficiently narrow permissions.

An account connector may be allowed to:
- read account identity needed to select the correct marketplace
- read shopping lists
- create or remove entries in shopping lists
- read orders
- read shipment/tracking information

An account connector must never be allowed to:
- add items to Amazon's shopping cart
- place an order
- enter or automate checkout
- access or change payment methods
- change shipping addresses
- store an authenticated Amazon retail browser cookie/session

At present, Login with Amazon is not treated as an order/wishlist API. A future
connector must be implemented only from documented official Amazon capabilities.

If no compliant account API exists for a marketplace, Shopping Companion falls
back to Homey's own shopping lists plus official/public product-provider data.
