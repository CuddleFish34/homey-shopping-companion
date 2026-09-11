# Amazon Companion for Homey

A Homey Pro app for private shopping lists, Amazon product monitoring and parcel events.

> **Safety by design:** Amazon Companion never places orders, enters checkout,
> modifies payment methods or changes shipping addresses. Purchases are always
> completed manually by the user on Amazon.

## Goals

- Keep shopping-list data on the user's own Homey Pro.
- Support multiple Amazon marketplaces, countries and currencies.
- Monitor product price and availability.
- Trigger Homey Flows on useful shopping and delivery events.
- Expose a protected Homey App Web API for a future ChatGPT connector.
- Avoid storing Amazon passwords, browser cookies or authenticated retail sessions.

## Current v0.1 scaffold

The app already has persistent storage for:
- shopping lists and list items
- Amazon product records (URL / ASIN / marketplace)
- price and availability observations
- parcel tracking records
- per-Homey preferences

Supported marketplace metadata includes Amazon SE, DE, UK, US and the other
marketplaces currently listed by Amazon Creators API.

## Flow triggers

- Product price changed
- Price dropped by an absolute amount
- Price dropped by a percentage
- Product back in stock
- Product out of stock
- Product unavailable
- New tracking number
- Shipment status changed
- Shipment delivered
- Product added to shopping list

## Flow actions and conditions

Actions can create lists, add/remove products, mark an item ordered, add a
tracking number, update shipment status and feed read-only product observations.
Conditions can test stock, price, list membership and delivery state.

## Architecture

```
ChatGPT (future)
      |
protected MCP / Homey connector
      |
Athom/Homey API
      |
Homey Pro — Amazon Companion
  |       |        |
 lists  products  parcels
      |
read-only product/provider adapters
```

Homey's App Web API endpoints remain protected. No endpoint for buying,
ordering, cart management, checkout, payments or address changes exists.

## Amazon account access

Amazon Login currently exposes identity/profile scopes, not a general consumer
API for wish lists, orders or parcel history. Amazon Companion will therefore
never use a captured Amazon browser session as a substitute.

If Amazon later provides an official read-only customer API, it can be added as
an optional provider with the minimum scopes required. Any purchasing scope will
remain unsupported by design.

## Website

Public documentation is planned for:

**https://apps.creson.com/AmazonCompanion**

The initial static source lives in `website/`.

## Development

```bash
npm install
homey app build
homey app validate
```

Homey Pro is the first target because the protected App Web API is required for
the planned ChatGPT integration.

## Disclaimer

This is an independent community project and is not affiliated with or endorsed
by Amazon. Amazon and related marks belong to their respective owners.
