import { lookup as lookupDns } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { EnvHttpProxyAgent } from "undici";

const denied = new BlockList();
const deniedV6 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
])
  denied.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
])
  deniedV6.addSubnet(network, prefix, "ipv6");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
export class FeedError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function isPublicAddress(address) {
  const family = isIP(address);
  return family === 4
    ? !denied.check(address, "ipv4")
    : family === 6
      ? globalV6.check(address, "ipv6") && !deniedV6.check(address, "ipv6")
      : false;
}
export function calendarUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 8192)
    throw new FeedError(
      "Paste a valid HTTPS or webcal calendar subscription link.",
    );
  let url;
  try {
    url = new URL(value.trim().replace(/^webcal:/i, "https:"));
  } catch {
    throw new FeedError(
      "Paste a valid HTTPS or webcal calendar subscription link.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new FeedError(
      "Use an HTTPS or webcal subscription link without a username, password, or custom port.",
    );
  url.hash = "";
  return url;
}
// Direct connections reuse the already-validated DNS result, rather than resolving
// the hostname a second time at socket creation. For configured HTTPS proxies,
// the trusted proxy owns remote DNS and network policy; retain that routing.
export function createPinnedLookup(hostname, addresses) {
  return (requested, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    const normalized = String(requested).toLowerCase().replace(/\.$/, "");
    const eligible = addresses.filter(
      (item) =>
        isPublicAddress(item.address) &&
        (!options?.family || isIP(item.address) === options.family),
    );
    if (normalized !== hostname || !eligible.length) {
      queueMicrotask(() =>
        callback(
          new Error(
            "Calendar DNS destination did not match the validated public address.",
          ),
        ),
      );
      return;
    }
    queueMicrotask(() =>
      options?.all
        ? callback(
            null,
            eligible.map((item) => ({
              address: item.address,
              family: isIP(item.address),
            })),
          )
        : callback(null, eligible[0].address, isIP(eligible[0].address)),
    );
  };
}
export function createFeedFetcher({
  fetch = globalThis.fetch,
  lookup = lookupDns,
} = {}) {
  return async function fetchCalendar(value) {
    let url = calendarUrl(value);
    for (let hop = 0; hop < 5; hop++) {
      const hostname = url.hostname
        .replace(/^\[|\]$/g, "")
        .toLowerCase()
        .replace(/\.$/, "");
      if (
        hostname === "localhost" ||
        /\.(localhost|local|internal|lan|home)$/.test(hostname)
      )
        throw new FeedError(
          "Calendar links must point to a public HTTPS server.",
        );
      let addresses;
      try {
        addresses = isIP(hostname)
          ? [{ address: hostname }]
          : await lookup(hostname, { all: true, verbatim: true });
      } catch {
        throw new FeedError(
          "The calendar server could not be found. Check the subscription link.",
          502,
        );
      }
      if (
        !addresses.length ||
        addresses.some(({ address }) => !isPublicAddress(address))
      )
        throw new FeedError(
          "Calendar links must point to a public HTTPS server.",
        );
      const dispatcher = new EnvHttpProxyAgent({
        connect: { lookup: createPinnedLookup(hostname, addresses) },
      });
      try {
        let response;
        try {
          response = await fetch(url, {
            dispatcher,
            redirect: "manual",
            headers: {
              Accept: "text/calendar, text/plain;q=0.8",
              "User-Agent": "Orbit-Calendar/2.0",
            },
            signal: AbortSignal.timeout(15000),
          });
        } catch {
          throw new FeedError(
            "The calendar feed could not be reached. Check its sharing settings and try again.",
            502,
          );
        }
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (!location)
            throw new FeedError(
              "The calendar server returned an invalid redirect.",
              502,
            );
          try {
            url = calendarUrl(new URL(location, url).href);
          } catch {
            throw new FeedError(
              "The calendar server redirected to an unsupported address.",
              502,
            );
          }
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new FeedError(
            response.status === 401 || response.status === 403
              ? "The calendar feed is not accessible. Use a subscription link that works without signing in."
              : `The calendar server returned an error (${response.status}).`,
            502,
          );
        }
        if (Number(response.headers.get("content-length")) > 2 * 1024 * 1024) {
          await response.body?.cancel();
          throw new FeedError(
            "The calendar feed is larger than the 2 MB limit.",
            413,
          );
        }
        const reader = response.body?.getReader();
        if (!reader) throw new FeedError("The calendar feed was empty.", 502);
        let size = 0;
        const chunks = [];
        try {
          while (true) {
            const { done, value: chunk } = await reader.read();
            if (done) break;
            size += chunk.byteLength;
            if (size > 2 * 1024 * 1024) {
              await reader.cancel();
              throw new FeedError(
                "The calendar feed is larger than the 2 MB limit.",
                413,
              );
            }
            chunks.push(chunk);
          }
        } catch (error) {
          if (error instanceof FeedError) throw error;
          throw new FeedError(
            "The calendar download was interrupted. Please try again.",
            502,
          );
        }
        return {
          url: url.href,
          content: Buffer.concat(chunks).toString("utf8"),
        };
      } finally {
        await dispatcher.close();
      }
    }
    throw new FeedError("The calendar server redirected too many times.", 502);
  };
}
