# Deep-dive review — 2026.11.18-r46-review

The supplied review inspected an older GitHub branch. Its useful recommendations were checked against the current local source, including the newer Spotify player/shelf, Drive, Search, Next photo, file conversion, syllabus import, Sounds and audit reliability work.

| Recommendation | Decision and implementation |
| --- | --- |
| Publish current local code | Publish the latest verified, sanitized source on the Midnight branch. Remove retired modules, backup HTML, obsolete checks/reports and generated/private files from the current tree; preserve history. |
| Prefer 1080p and release unused decoders | Already implemented locally. Retained and retested; 4K remains an explicit choice. |
| Lower blur / increase card opacity | Efficient already disabled all backdrop filters. Optional glass now caps blur at 18px and keeps opaque home cards free of backdrop sampling. No whole-dashboard speed percentage is inferred from CSS. |
| Play video only while focused | Implemented as the default, with a remembered visible-window override. Blur pauses at the existing frame; hidden/reduced-motion/off releases decoder work as before. Spotify and Focus remain independent. |
| Missing fallback videos | A source clone intentionally supports credited stills. Optional bundled MP4s are detected by the backend and retained on updates; source startup does not repeatedly request absent media. The catalog/posters are cached offline. Large/licensed videos are not added to Git. |
| Remove personal LAN default | Blank by default. Disabled setup accepts blank; enabling requires a valid private IPv4 address. Existing saved setup is preserved. |
| Reduce bootstrap exposure | Saved calendar subscription URLs no longer appear in bootstrap/settings responses. Browser gets a configured flag and provider hostname; blank unchanged replacement fields retain the secret. The Spotify Client ID remains visible because it is a public OAuth identifier, not a credential. |
| Single wallpaper source | Both runtime layers consume `static/wallpapers/scenes.json`; duplicated filenames, dimensions and creator credits were removed from JS/Python. Original included-footage attribution is retained, and the credit now follows the actual displayed frame, including switching back to the included still when motion is off. |
| Remove contradictory stale modules/rules | Retired Spaces modules were already absent from active JS. Remaining dead CSS, backup artifacts and obsolete checks/reports are removed from this release. AGENTS explains the actual provider, metadata, still-only and playback policies. |
| Reduce idle tick | Already implemented by the visibility-aware activity scheduler: minute cadence at idle, seconds only for live playback/timers, no hidden polling loop. Retained with existing cadence tests. |

All automated changes are tested with isolated data, synthetic media and fake account/device boundaries. Actual signed-in services, real microphones, Windows/hybrid hardware and physical power acceptance remain separate. The current verification record distinguishes measured component behavior from unmeasured GPU/frame-rate improvements.
