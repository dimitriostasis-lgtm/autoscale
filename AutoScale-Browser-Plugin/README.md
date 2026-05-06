# AutoScale Browser Plugin

Chrome Manifest V3 extension for capturing primary media from webpages into AutoScale workspace tables.

## What It Does

- Detects high-quality page images, videos, and audio while ignoring small UI media such as icons, logos, avatars, buttons, and thumbnails.
- Shows a `Robot` button over a valid asset while the pointer is over that asset.
- Includes an always-on/off switch in the popup. When paused, the robot button is hidden on all pages and the extension badge shows `OFF`.
- Sends the selected visible asset/page reference to the AutoScale server, which downloads and stores the asset before placing it in the next available row for the selected influencer profile.
- Routes assets by type:
  - Images -> Image table, using the popup SFW/NSFW toggle.
  - Videos -> Video table, using the popup SFW/NSFW toggle.
  - Audio -> disabled unless a voice worker is added back to the extension model list.
- Lets the popup configure the run target, workflow label, image layout, curated image/video models, GPT Image 2 quality, model-specific resolution, model-specific aspect ratio, quantity, and duration before captured assets create or update tables.
- Image workers in the popup are Nano Banana Pro, Nano Banana 2, Seedream 4.5, GPT Image 2, Flux 2 Pro, Kling O1 Image, Flux Kontext Max, Z Image, and SDXL.
- Video workers in the popup are Seedance 2.0 and Kling 3.0.
- Keeps the popup organized with collapsible account, routing, workflow, image, and media sections.
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

- The extension sends visible media URLs and page permalinks to `/api/remote-assets`; the AutoScale server performs the download and saves a stable local upload path for workflow runs.
- For AWS or production-like deployments, install `yt-dlp` on the server, or set `REMOTE_ASSET_RESOLVER_BIN` / `YTDLP_BIN` to its path. The server uses it as a fallback for platform page links when direct media URLs are not exposed.
- TikTok and similar platforms can expose JavaScript bundles, playlists, byte ranges, or stream fragments in the same network list as the visible video. The extension now prioritizes the visible/centered post link and lets the server resolve/download the final playable asset.
