# Midnight live backgrounds refinement · November 17, 2026

Refines the existing calm dashboard. The home and dock navigation are retained. Original hourglass/lamp SVG icons replace the Focus reticle and Room power glyph; Read uses the existing open-book icon. Seven font cards show real digit samples and apply the selected font immediately.

Nature is the new default (migrating the previous Automatic default once; explicit Black, Light and seasonal selections are retained). Nature and Rain include real 3840×2160 muted Pexels videos, with local posters and creator/Pexels links. Black, Automatic, Light and Christmas remain available. Rotating scenes use a separately configured server-side Pexels key. No key is included in source or the package.

## Verification

- 51 Python tests pass, including nine wallpaper tests: key redaction/preservation, request validation/CSRF, no-key local fallback, quality selection/URL allowlists, isolated authenticated API requests, disk cache reuse, failed rotation preservation, oversize downloads and manual rotation/cooldown. Existing installation preservation and rollback checks pass.
- 24 Node tests pass: existing capture/restore, task focus, timer persistence, command search and weather rules. Four tests cover the retired, unloaded Spaces store.
- Browser inspection on an isolated origin: Nature decodes at 3840×2160 and plays muted; Rain decodes at 3840×2160 and plays muted. The previous video pauses when the next scene takes over. Turning motion off pauses both video elements. Black hides the credit and pauses both. Christmas retains its tree.
- Real font-family values and selected clock font checked, with distinct sample cards. Settings and panels checked at 1440×900 and 1024×768. Compact home has no horizontal overflow; its dock remains below the cards. Background preferences saved through the actual local backend.
- Browser-only QA data is isolated from the installed application. No user captures/drafts were changed, no Spotify playback was sent and no physical devices were switched.
- scripts/build.py syntax-checks JavaScript and verifies local asset references. Distribution includes the wallpaper backend, videos, posters and tests, excluding saved keys and private data.

## Limits

Pexels API rotation uses mocked API/download responses in automated tests; a real account key is required to verify live authenticated search/download against Pexels. Included 4K videos use real downloaded Pexels footage and were tested in the browser. Windows and actual reduced-motion/hidden-window behavior were not directly exercised in this session; the implementation listens to visibility and OS motion preference changes. No performance percentage claims are made.

API errors preserve a downloaded scene or included fallback. Catalogs cache for six hours; failed requests back off for 30 minutes. At most two clips per scene/quality are retained, capped at 120 MB each. A key/quality preference change clears catalog/retry state. The browser loads only local video URLs; all API keys and authenticated requests remain in the loopback-only backend. A complete shell is cached before the service worker activates; large MP4s stay outside the service-worker cache, with posters supporting the server-down fallback.

## Installed

Applied to the original installation. All three existing saved server files were byte-identical after the stopped-server update. The previous source is in upgrade-backups/20261117-114941-771806. The installed backend and static assets match the reviewed release. A synthetic note saved through Capture appeared in Inbox while a live background was playing, using the separate test origin.

## Longer clips and town labels

The included clips now run approximately 60.43 seconds (Nature, 3840×2160) and 59.26 seconds (Rain, 4096×2160). Playback duration is preserved through H.264 compression; no short footage is repeated to simulate a longer source. API selection rejects clips under 60 seconds, accepts up to 10 minutes, and invalidates cached short clips. The per-file bound is now 256 MB, with an HD fallback for oversized 4K renditions.

The main weather heading uses a city/town name. Unnamed coordinates resolve from a bundled GeoNames extract on this computer; timezone labels are no longer used as place names. The local nearest-place lookup is approximate, with exact city search retained. Tests cover Buffalo, Williamsville, Sydney, remote-ocean behavior, endpoint validation and no network access. Explicitly selected city names survive unchanged coordinate saves.

Long-clip browser check: Nature decoded at 3840×2160 with duration 60.427 seconds; the weather heading resolved the public test coordinates to Buffalo. API selection, oversized-HD fallback and town lookup tests bring automated coverage to 58 Python plus 24 Node checks (82 total). No real captures, playback or physical-device states were modified.

Installed longer-clip update: all four existing saved server files were byte-identical after the stopped-server installation. Previous source is in upgrade-backups/20261117-122821-487909. Rain playback was verified at 59.259 seconds and 4096×2160.
