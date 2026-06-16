# Clip Forge

A browser-based video editor that runs entirely locally — no uploads, no server, no account. Powered by FFmpeg.wasm so all processing happens in your browser.

## Features

- **Trim & cut** video clips directly in the browser
- **Canvas-based editor** (Fabric.js) for overlays, text, and drawing
- **Audio waveform** visualization via WaveSurfer.js
- **FFmpeg.wasm** — full FFmpeg processing, zero server-side processing
- **No uploads** — your files never leave your machine

## Stack

- React + Vite
- [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) — WebAssembly FFmpeg
- [Fabric.js](http://fabricjs.com/) — canvas editor
- [WaveSurfer.js](https://wavesurfer.xyz/) — audio waveform
- Docker-ready

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
