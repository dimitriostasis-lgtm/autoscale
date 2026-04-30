# AutoScale Browser Plugin

Chrome Manifest V3 extension for capturing primary media from webpages into AutoScale workspace tables.

## What It Does

- Detects high-quality page images, videos, and audio while ignoring small UI media such as icons, logos, avatars, buttons, and thumbnails.
- Shows a `Robot` button over a valid asset while the pointer is over that asset.
- Uploads the selected asset into AutoScale and places it in the next available row for the selected influencer profile.
- Routes assets by type:
  - Images -> Image table, using the popup SFW/NSFW toggle.
  - Videos -> Video table, using the popup SFW/NSFW toggle.
  - Audio -> Voice/audio table.
- Lets the popup configure the run target, workflow label, image layout, image/video models, resolution, aspect ratio, quantity, duration, and audio model before captured assets create or update tables.
- Adds rows until a table reaches 8 rows, then creates the next table for that asset type.
- Runs all tables touched in the current plugin session from the popup.

## Local Installation

1. Start the AutoScale server and client as usual.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select this folder: `AutoScale-Browser-Plugin`.
6. Open the extension popup, set the API URL, and log in with your AutoScale credentials.

For local development the default API URL is:

```text
http://localhost:4000
```

## Notes

- Some platforms expose media as short-lived or page-local `blob:` URLs. Those cannot be uploaded after leaving the page context, so the extension only captures assets with downloadable `http`, `https`, or `data` URLs.
- TikTok and similar platforms can expose JavaScript bundles, playlists, byte ranges, or stream fragments in the same network list as the visible video. The extension inspects page hydration data for `playAddr` / `downloadAddr` candidates, validates downloaded videos before upload, and only marks capture as successful when the file is a standalone MP4/WebM/Ogg-style browser-playable container.
- Captured files are uploaded to AutoScale via `/api/uploads`, so workflow runs use stable AutoScale file paths rather than hotlinked third-party URLs.
