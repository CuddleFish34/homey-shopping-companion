# Security model

Amazon Companion follows a deliberately narrow capability model.

## Never supported

The app must never expose or implement:
- order placement or one-click purchasing
- shopping-cart modification
- checkout automation
- payment-method access or modification
- shipping-address access or modification
- storage of Amazon passwords
- storage of authenticated Amazon browser cookies or retail sessions

These are architectural constraints, not UI preferences.

## Allowed capabilities

The app may:
- read public or officially authorized read-only product data
- create, edit and delete its own Homey shopping-list entries
- monitor price and availability
- store user-supplied or read-only parcel tracking data
- mark list items as ordered/delivered based on trusted read-only events
- remove list items according to user preferences

## External integrations

Only official read-only APIs or user-provided data should be used for account
information. If an integration requires a captured authenticated retail browser
session, it must not be implemented.

Homey App Web API routes are protected by Homey authentication by default.
No public API route should be added without a documented security reason.
