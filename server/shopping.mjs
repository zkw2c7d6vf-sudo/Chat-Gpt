const tokenCache = new Map();
export class ShoppingError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}
function cleanQuery(value) {
  const query = String(value || "")
    .trim()
    .slice(0, 120);
  if (!query) throw new ShoppingError("Enter something to shop for.", 400);
  return query;
}
export function createShoppingService({
  fetch = globalThis.fetch,
  env = process.env,
} = {}) {
  const clientId = env.EBAY_CLIENT_ID;
  const clientSecret = env.EBAY_CLIENT_SECRET;
  const marketplace = env.EBAY_MARKETPLACE_ID || "EBAY_US";
  const configured = Boolean(clientId && clientSecret);
  async function token() {
    const cached = tokenCache.get(clientId);
    if (cached && cached.expires > Date.now()) return cached.value;
    const response = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new ShoppingError(
        "eBay authorization failed. Check the private eBay app settings.",
      );
    const data = await response.json();
    if (typeof data.access_token !== "string")
      throw new ShoppingError("eBay did not return a usable catalog token.");
    tokenCache.set(clientId, {
      value: data.access_token,
      expires:
        Date.now() + Math.max(60, Number(data.expires_in || 7200) - 60) * 1000,
    });
    return data.access_token;
  }
  return {
    configured,
    async feed(rawQuery = "popular") {
      const query = cleanQuery(rawQuery);
      if (!configured)
        return {
          configured: false,
          provider: "eBay",
          items: [],
          message:
            "Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET to show live product cards.",
        };
      const accessToken = await token();
      const url = new URL(
        "https://api.ebay.com/buy/browse/v1/item_summary/search",
      );
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "24");
      url.searchParams.set("fieldgroups", "EXTENDED");
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-EBAY-C-MARKETPLACE-ID": marketplace,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new ShoppingError(
          `eBay product search returned HTTP ${response.status}.`,
        );
      const data = await response.json();
      const items = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
      return {
        configured: true,
        provider: "eBay",
        query,
        items: items.slice(0, 24).map((item) => ({
          id: String(item.itemId || crypto.randomUUID()),
          title: String(item.title || "Untitled listing"),
          image:
            item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || null,
          url: item.itemWebUrl || null,
          price:
            item.price?.value != null &&
            Number.isFinite(Number(item.price.value)) &&
            Number(item.price.value) >= 0
              ? Number(item.price.value)
              : null,
          currency: item.price?.currency || "USD",
          shipping:
            item.shippingOptions?.[0]?.shippingCost?.value != null &&
            Number.isFinite(
              Number(item.shippingOptions[0].shippingCost.value),
            ) &&
            Number(item.shippingOptions[0].shippingCost.value) >= 0
              ? Number(item.shippingOptions[0].shippingCost.value)
              : null,
          condition: item.condition || null,
          seller: item.seller?.username || null,
        })),
      };
    },
  };
}
