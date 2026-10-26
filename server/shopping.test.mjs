import test from "node:test";
import assert from "node:assert/strict";
import { createShoppingService } from "./shopping.mjs";

test("eBay shopping adapter returns image-backed listings without exposing credentials", async () => {
  const requests = [];
  const service = createShoppingService({
    env: {
      EBAY_CLIENT_ID: "client-id",
      EBAY_CLIENT_SECRET: "client-secret",
      EBAY_MARKETPLACE_ID: "EBAY_US",
    },
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      if (String(url).includes("identity/v1/oauth2/token"))
        return Response.json({
          access_token: "private-token",
          expires_in: 3600,
        });
      return Response.json({
        itemSummaries: [
          {
            itemId: "v1|123|0",
            title: "Orbit desk lamp",
            image: { imageUrl: "https://i.ebayimg.com/lamp.jpg" },
            itemWebUrl: "https://www.ebay.com/itm/123",
            price: { value: "29.99", currency: "USD" },
            shippingOptions: [{ shippingCost: { value: "4.99" } }],
            condition: "New",
            seller: { username: "orbit-seller" },
          },
        ],
      });
    },
  });
  const result = await service.feed("desk lamp");
  assert.equal(result.configured, true);
  assert.deepEqual(result.items[0], {
    id: "v1|123|0",
    title: "Orbit desk lamp",
    image: "https://i.ebayimg.com/lamp.jpg",
    url: "https://www.ebay.com/itm/123",
    price: 29.99,
    currency: "USD",
    shipping: 4.99,
    condition: "New",
    seller: "orbit-seller",
  });
  assert.equal(requests.length, 2);
  assert.match(requests[1].options.headers.Authorization, /^Bearer /);
  assert.equal(JSON.stringify(result).includes("client-secret"), false);
});
