# Protocol 150 media kit

This directory contains a digital-only presentation of Protocol 150. Every screenshot comes from the real application; the compositions add only framing, labels, and a consistent visual background. No people, private venues, live photographs, or personal device content are used.

## Included assets

```text
docs/media/
├── screenshots/
│   ├── hero.webp
│   ├── player-game.webp
│   ├── mutual-sync.webp
│   ├── host-panel.webp
│   ├── venue-setup.webp
│   └── nfc-qr.webp
└── video/
    ├── protocol-150-demo.mp4
    └── protocol-150-demo-poster.webp
```

| File | Resolution | Content |
| --- | ---: | --- |
| `hero.webp` | 1600 × 900 | Mobile entry, a minigame, and the host dashboard |
| `player-game.webp` | 1200 × 900 | Packet Routing running in the real mobile layout |
| `mutual-sync.webp` | 1200 × 900 | Two real browser clients at the same synchronized percentage |
| `host-panel.webp` | 1600 × 1000 | Live lobby status, roster, controls, and diagnostics |
| `venue-setup.webp` | 1200 × 900 | The editable ten-location privacy-safe template |
| `nfc-qr.webp` | 1200 × 900 | The generated host link sheet and QR fallback workflow |
| `protocol-150-demo-poster.webp` | 1600 × 900 | Clickable cover for the README video link |
| `protocol-150-demo.mp4` | 1280 × 720 | 27-second H.264 interface overview without audio |

The current media uses neutral demo names such as `Alex Morgan` and `John Doe`, fictional venue labels, a disposable lobby, and `localhost` for the QR demonstration. The mutual synchronization image was captured from two separate browser clients connected to the same server state.

## Replacing a screenshot

1. Build and start the same-origin production version.
2. Create a disposable lobby with fictional player names and venue labels.
3. Switch the interface to English for the public documentation set.
4. Capture only the browser viewport; exclude browser chrome and notifications.
5. Keep mobile captures at a consistent portrait viewport and desktop captures at 1200 px or wider.
6. Composite only real application screens. Do not invent controls or claim behavior the application does not implement.
7. Export WebP at approximately 80–85% quality and strip metadata.
8. Replace the existing file without changing its name so README links remain valid.

## Replacing the video

- Keep the repository version under roughly one minute.
- Use 1280 × 720 or 1920 × 1080 H.264 video in an MP4 container.
- Use `yuv420p` for broad browser and mobile compatibility.
- Keep audio optional. The current overview is intentionally silent.
- Show only real UI states: entry, venue setup, a minigame, synchronization, host controls, and QR/NFC preparation.
- Export with web-optimized metadata placement such as FFmpeg's `-movflags +faststart`.

GitHub does not play every repository-hosted MP4 inline in every view. The main README therefore uses `protocol-150-demo-poster.webp` as a clickable cover linked to `protocol-150-demo.mp4`.

## Digital privacy checklist

- Use fictional player and venue names.
- Never capture admin passwords, tunnel tokens, private hostnames, or production lobby recovery data.
- Use a disposable lobby and shut it down after capture.
- Keep notification previews, bookmarks, browser profiles, and personal tabs outside the frame.
- Inspect QR codes and visible URLs before publishing.
- Strip EXIF, author, GPS, and source-path metadata from final images.
- Do not include people or private-room photography in this media set.
