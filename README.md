# Clip Forge

A full-featured video editor that runs entirely in your browser — no uploads, no account, no install.

🔗 **Live:** [clip-forge.hackatoa.com](https://clip-forge.hackatoa.com)   ·   ☕ **Support:** [Buy Me a Coffee](https://buymeacoffee.com/hackatoa)

## Overview

Clip Forge is a client-side, multi-track video editor. Everything is processed locally in the browser, so your media never leaves your device. Trim, split, and arrange clips across video/audio/image/text/shape tracks; add transitions, keyframes, filters, chroma key, and export up to 8K.

## Features

- Multi-track timeline (video / audio / image / text / shape / voiceover)
- Trim, split, snap, copy/paste, undo/redo, multi-select
- Keyframes, transitions & crossfades, filters, color grading, chroma key
- Save/load projects as a single `.clipforge` file
- WebM export + optional FFmpeg.wasm MP4 transcode (up to 8K)
- 6-language localization

## Tech Stack

React · Vite · Web Audio / Canvas / WebGL · FFmpeg.wasm · Express · Docker

## Development

```bash
npm install
npm run dev
```

## Deployment

Docker on the homelab host; GHCR + Watchtower auto-deploy. The production server sends COOP/COEP headers so FFmpeg.wasm MP4 export works.

## Support

If this project is useful to you, consider supporting development:

☕ **[Buy Me a Coffee](https://buymeacoffee.com/hackatoa)**

---

Part of the **[Hackatoa](https://hackatoa.com)** ecosystem — self-hosted apps, browser games, and bots. · [All repositories »](https://github.com/Hackatoan)
