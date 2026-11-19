# Asset credits

- **Christmas tree photograph:** Matthew Ball (@tex450), “a large christmas tree with lights and decorations,” published December 13, 2022. [Photo page](https://unsplash.com/photos/a-large-christmas-tree-with-lights-and-decorations-_1SEuDqPLXs). Used under the [Unsplash License](https://unsplash.com/license). The locally bundled JPEG is displayed with CSS blending and fading to match the dashboard; it is a real photograph, not generated imagery.
- **Weather and location icons:** [Lucide](https://github.com/lucide-icons/lucide), ISC license. The upstream license is included at `static/icons/LICENSE`. Icons are bundled locally.
- **Spotify logo:** Spotify’s official primary green mark. Source and ownership are documented in `DESIGN-NOTES.md`.

## Longer live backgrounds · November 17, 2026

- `static/wallpapers/nature-long.mp4` and `nature-long.jpg`: Tom Fisk, *Tranquil River Sunrise with Misty Landscape*, https://www.pexels.com/video/tranquil-river-sunrise-with-misty-landscape-32329775/ . Source 3840×2160, approximately 60.43 seconds.
- `static/wallpapers/rain-long.mp4` and `rain-long.jpg`: Engin Akyurt, *Green Tree Leaves Swaying in the Wind*, https://www.pexels.com/video/green-tree-leaves-swaying-in-the-wind-11887609/ . Source 4096×2160, approximately 59.26 seconds.

Videos have been re-encoded to H.264 at about 8 Mbps with audio removed; original duration and 4K resolution are retained. Posters are extracted video frames. They replace the previous 8- and 11-second included clips.

Pexels License: https://www.pexels.com/license/ . Creator and Pexels links remain visible. API-selected clips retain their individual credits. This is a dashboard background feature, not a stock distribution service. Usage guidance: https://help.pexels.com/hc/en-us/articles/4405588861721-Can-I-use-the-API-as-a-wallpaper-app .

Local town labels use a reduced GeoNames cities1000 extract, under CC BY 4.0. See `geodata/README.md` for source, license and changes. Town lookup does not send user coordinates to an external service.

The hourglass and lamp icons are original SVG paths matching the existing outline icon set.


## Ambient recordings

The following are real field recordings supplied as high-quality MP3
encodings by Freesound. Midnight stores the recordings locally and repeats at each
file's end. The rain-and-thunder MP3 is losslessly remuxed to repair its duration header;
audio frames are copied without re-encoding or synthesized layers. No synthesized or AI-generated audio is used. The source
catalog, duration and download checksums are in `ambient-recordings.json`.

- **Rain on Tin Roof - 1 Hour** by **archerjosiah**, 56:30.380. Recorded inside a garden
  shed during medium rain. [Source](https://freesound.org/people/archerjosiah/sounds/843483/),
  [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- **Rain and ocasional thunder.mp3** by **Simon Spiers**, 82:01.601 in the supplied MP3 (the source page describes a
  122:15.329 original). Gentle rain and
  distant thunder recorded from a roof in Sussex.
  [Source](https://freesound.org/people/Simon%20Spiers/sounds/394600/),
  [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- **Thunderstorm Baltic Sea** by **Borgory**, 27:27.579. An actual outdoor thunderstorm,
  recorded with a Zoom H1 on Germany's Baltic Sea coast.
  [Source](https://freesound.org/people/Borgory/sounds/870414/),
  [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- **Rain Against The Jeep From The Interior 9-20-22 .wav** by **Ambient-X**, 84:00.
  Real rain and thunder heard from inside a parked Jeep Cherokee in Warren, Michigan;
  the roof is the vehicle's metal roof. [Source](https://freesound.org/people/Ambient-X/sounds/650969/),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Midnight uses Freesound's
  MP3 encoding without additional edits; the creator/source/license remain visible
  in the player. No endorsement by the creator is implied.

## Conversion font

Text-to-PDF embeds DejaVu Sans for Unicode text. The font is bundled in
`static/fonts/DejaVuSans.ttf` under the Bitstream Vera/DejaVu license, reproduced in
`static/fonts/DejaVu-LICENSE.txt`. [Project](https://dejavu-fonts.github.io/).
