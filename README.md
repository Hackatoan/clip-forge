# Clip Forge

A browser-based video editor that runs entirely locally — no uploads, no server, no account. All rendering happens in your browser.

## Features

- **Multi-track timeline** — video, audio, image, text, shape, and voiceover tracks
- **Trim, move, split & snap** — drag clips, trim edges, split at the playhead, edges snap to neighbours
- **Keyframe animation** — animate opacity, scale, position, rotation & volume over time with eased interpolation; keyframe markers on the timeline
- **Undo / redo** with full history
- **Copy · paste · duplicate** clips
- **Save / load projects** — self-contained `.clipforge.json` files with media embedded; survives reloads and is shareable as a single file
- **Media import** — video, audio, and images
- **Aspect-ratio presets** — 16:9, 9:16, 1:1, 4:3, 21:9 (canvas resizes live)
- **Clip playback speed** — 0.25×–4× slow-mo / fast-motion
- **Transform** — scale, position, rotation, flip, and fit (cover / contain / fill) on video, images, text & shapes
- **Colour filters & presets** — brightness, contrast, saturation, blur, grayscale + one-click looks (B&W, Vintage, Warm, Cool, Vivid)
- **Blend modes** — multiply, screen, overlay, lighten, darken, add
- **Audio fades** — per-clip fade in / fade out, volume, mute
- **Transitions** — separate in / out: fade, zoom, slide (4 directions), rendered in preview and export
- **Voiceover recording** straight from your mic
- **Live canvas preview** with real audio playback + loop
- **Text & shape overlays** — fonts, bold/italic, colours, alignment, background, stroke; rectangles, circles, triangles
- **Real export** — renders the timeline to **WebM** (native) or **MP4** (H.264 via FFmpeg.wasm) at 480/720/1080p
- **No uploads** — all processing happens locally in your browser

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / pause |
| `←` / `→` | Step playhead 0.1s (hold `Shift` for 1s) |
| `Home` / `End` | Jump to start / end |
| `Ctrl/⌘ + Z` / `Ctrl/⌘ + Shift + Z` (or `Y`) | Undo / redo |
| `Ctrl/⌘ + C` / `V` / `D` | Copy / paste / duplicate clip |
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
