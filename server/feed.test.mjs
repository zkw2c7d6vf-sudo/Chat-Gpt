import test from "node:test";
import assert from "node:assert/strict";
import {
  createFeedFetcher,
  isPublicAddress,
  calendarUrl,
  createPinnedLookup,
} from "./feed.mjs";
const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
test("feed URLs normalize webcal and reject unsafe protocols, credentials and ports", () => {
  assert.equal(
    calendarUrl("webcal://calendar.example/feed.ics?token=private").protocol,
    "https:",
  );
  for (const value of [
    "file:///etc/passwd",
    "http://calendar.example/feed.ics",
    "https://user:secret@calendar.example/feed.ics",
    "https://calendar.example:444/feed.ics",
  ])
    assert.throws(() => calendarUrl(value));
});
test("feed IP validation rejects local, reserved, mapped and multicast addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.2",
    "169.254.169.254",
    "172.16.3.2",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "fc00::1",
    "2001:db8::1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  for (const address of ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])
    assert.equal(isPublicAddress(address), true, address);
});
test("feed redirects validate every destination without exposing the secret URL in errors", async () => {
  let calls = 0;
  const read = createFeedFetcher({
    lookup: publicLookup,
    fetch: async () => {
      calls++;
      return new Response(null, {
        status: 302,
        headers: { Location: "https://127.0.0.1/private?token=hidden-secret" },
      });
    },
  });
  await assert.rejects(
    () => read("https://calendar.example/feed?token=hidden-secret"),
    (error) => !/hidden-secret|127\.0\.0\.1/.test(error.message),
  );
  assert.equal(calls, 1);
});
test("feed hostname with any private DNS answer is rejected before fetch", async () => {
  let fetched = false;
  const read = createFeedFetcher({
    lookup: async () => [{ address: "93.184.216.34" }, { address: "10.1.1.1" }],
    fetch: async () => {
      fetched = true;
      return new Response("invalid");
    },
  });
  await assert.rejects(() => read("https://calendar.example/feed"));
  assert.equal(fetched, false);
});
test("feed body limits and failed auth are actionable without exposing private links", async () => {
  const oversized = createFeedFetcher({
    lookup: publicLookup,
    fetch: async () =>
      new Response("ignored", {
        headers: { "Content-Length": String(3 * 1024 * 1024) },
      }),
  });
  await assert.rejects(
    () => oversized("https://calendar.example/feed"),
    /2 MB/,
  );
  const denied = createFeedFetcher({
    lookup: publicLookup,
    fetch: async () => new Response(null, { status: 403 }),
  });
  await assert.rejects(
    () => denied("https://calendar.example/feed?token=secret"),
    /without signing in/,
  );
});
test("feed fetch reads successful calendar content and follows HTTPS redirect", async () => {
  let calls = 0;
  const content = "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
  const read = createFeedFetcher({
    lookup: publicLookup,
    fetch: async (url, options) => {
      assert.equal(options.redirect, "manual");
      calls++;
      return calls === 1
        ? new Response(null, {
            status: 302,
            headers: { Location: "/final.ics" },
          })
        : new Response(content);
    },
  });
  const data = await read("webcal://calendar.example/feed");
  assert.equal(data.content, content);
  assert.equal(data.url, "https://calendar.example/final.ics");
  assert.equal(calls, 2);
});

test("socket DNS lookup remains pinned to validated public answers and preserves family", async () => {
  const lookup = createPinnedLookup("calendar.example", [
    { address: "93.184.216.34", family: 4 },
    { address: "2606:4700:4700::1111", family: 6 },
  ]);
  const resolve = (hostname, options) =>
    new Promise((resolve, reject) =>
      lookup(hostname, options, (error, address, family) =>
        error ? reject(error) : resolve({ address, family }),
      ),
    );
  assert.deepEqual(await resolve("calendar.example", { family: 4 }), {
    address: "93.184.216.34",
    family: 4,
  });
  assert.deepEqual(await resolve("calendar.example", { family: 6 }), {
    address: "2606:4700:4700::1111",
    family: 6,
  });
  const all = await resolve("calendar.example", { all: true });
  assert.equal(all.address.length, 2);
  await assert.rejects(() => resolve("changed.example", {}), /did not match/);
  const privateLookup = createPinnedLookup("calendar.example", [
    { address: "127.0.0.1", family: 4 },
  ]);
  await assert.rejects(
    () =>
      new Promise((resolve, reject) =>
        privateLookup("calendar.example", {}, (error) =>
          error ? reject(error) : resolve(),
        ),
      ),
    /did not match/,
  );
});
