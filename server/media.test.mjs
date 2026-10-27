import test from "node:test";
import assert from "node:assert/strict";
import { createMediaService } from "./media.mjs";
test("media caches before fetching, shares concurrent calls, and keeps service instances independent", async () => {
  let calls = 0;
  const fetch = async () => {
    calls++;
    return Response.json([
      { show: { id: 5, name: "Show", rating: { average: null } } },
    ]);
  };
  const service = createMediaService({ fetch });
  const [first, second] = await Promise.all([
    service.search("show"),
    service.search("show"),
  ]);
  assert.deepEqual(first, second);
  assert.equal(first[0].rating, null);
  assert.equal(calls, 1);
  await service.search("SHOW");
  assert.equal(calls, 1);
  await createMediaService({ fetch }).search("show");
  assert.equal(calls, 2);
});
test("failed catalog requests are retryable and do not poison the cache", async () => {
  let calls = 0;
  const service = createMediaService({
    fetch: async () =>
      ++calls === 1
        ? new Response("unavailable", { status: 503 })
        : Response.json([]),
  });
  await assert.rejects(service.popular());
  assert.deepEqual(await service.popular(), []);
  assert.equal(calls, 2);
});
