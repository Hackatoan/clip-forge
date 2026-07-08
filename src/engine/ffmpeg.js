// Lazy FFmpeg.wasm loader. Used only for the optional WebM -> MP4 transcode
// on export. Requires cross-origin isolation (COOP/COEP headers) to run.
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpeg = null;
let loadPromise = null;

const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';

export function isCrossOriginIsolated() {
  return typeof window !== 'undefined' && window.crossOriginIsolated === true;
}

export async function loadFFmpeg(onProgress) {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    ffmpeg = new FFmpeg();
    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
    }
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ffmpeg;
  })();

  return loadPromise;
}

// Transcode a WebM blob to MP4 (H.264/AAC) using ffmpeg.wasm.
export async function transcodeToMp4(webmBlob, onProgress) {
  const ff = await loadFFmpeg(onProgress);
  await ff.writeFile('input.webm', await fetchFile(webmBlob));
  await ff.exec([
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    'output.mp4',
  ]);
  const data = await ff.readFile('output.mp4');
  return new Blob([data.buffer], { type: 'video/mp4' });
}
