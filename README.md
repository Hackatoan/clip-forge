# Clip Forge

A browser-based video editor that runs entirely locally — no uploads, no server, no account. All rendering happens in your browser.

## Features

- **Multi-track timeline** — video, audio, text, shape, and voiceover tracks
- **Trim, move, split & snap** — drag clips, trim edges, split at the playhead, edges snap to neighbours
- **Live canvas preview** with real audio playback (Web Audio graph)
- **Text & shape overlays** — fonts, colours, alignment, background, stroke; rectangles, circles, triangles
- **Transitions** — fade, zoom, slide, wipe (rendered in preview and export)
- **Voiceover recording** straight from your mic
- **Real export** — renders the timeline to **WebM** (native) or **MP4** (H.264 via FFmpeg.wasm)
- **Keyboard shortcuts** — Space to play/pause, Delete to remove a clip
- **No uploads** — all processing happens locally in your browser

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / pause |
| `Delete` / `Backspace` | Delete selected clip |
| Double-click clip | Split at playhead |

## Stack

- React + Vite
- Canvas 2D + `canvas.captureStream` + `MediaRecorder` for rendering/export
- Web Audio API for preview sound and the export audio mix
- [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) — WebAssembly FFmpeg for the optional MP4 transcode
- Express static server (sets COOP/COEP for cross-origin isolation)
- Docker-ready

> MP4 export needs the page to be **cross-origin isolated** (the bundled server sends the required `COOP`/`COEP` headers). WebM export works everywhere.

## Self-hosting

```bash
git clone https://github.com/Hackatoan/clip-forge
cd clip-forge
docker compose up --build
```

Or run locally:

```bash
npm install
npm run dev
```

---

[hackatoa.com](https://hackatoa.com) · [GitHub](https://github.com/Hackatoan) · [![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/hackatoa)
