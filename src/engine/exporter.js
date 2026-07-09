// Real-time timeline exporter.
// Plays the timeline start->end while capturing the render canvas
// (canvas.captureStream) plus the mixed audio (mediaEngine record stream)
// into a MediaRecorder. Produces a WebM blob; optionally transcoded to MP4.
import { mediaEngine } from './mediaEngine';
import { renderFrame } from './render';
import { transcodeToMp4 } from './ffmpeg';

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}

// opts: { tracks, duration, width, height, fps, format ('webm'|'mp4'),
//         onProgress(0..100), onStage(str) }
export async function exportTimeline(opts) {
  const {
    tracks, duration, width = 1280, height = 720, fps = 30,
    format = 'webm', onProgress = () => {}, onStage = () => {},
  } = opts;

  if (!duration || duration <= 0) throw new Error('Timeline is empty.');

  onStage('Preparing…');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  // Audio: ensure everything is wired into the graph and get the mixed stream.
  mediaEngine.sync(tracks);
  mediaEngine.wireAll();
  const audioStream = mediaEngine.getAudioStream();

  const videoStream = canvas.captureStream(fps);
  const tracksOut = [...videoStream.getVideoTracks()];
  audioStream.getAudioTracks().forEach(t => tracksOut.push(t));
  const combined = new MediaStream(tracksOut);

  const mimeType = pickMimeType();
  // Scale bitrate with resolution & fps (~0.12 bits/pixel), capped for 8K.
  const bitrate = Math.min(160_000_000, Math.round(width * height * fps * 0.12));
  const recorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: bitrate,
  });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  const done = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    recorder.onerror = e => reject(e.error || new Error('Recording failed'));
  });

  onStage('Recording…');
  recorder.start(100);

  // Drive real-time playback from 0.
  mediaEngine.play(0, tracks);

  const startWall = performance.now();
  await new Promise((resolve) => {
    const loop = () => {
      const elapsed = (performance.now() - startWall) / 1000;
      const ph = Math.min(elapsed, duration);
      mediaEngine.tick(ph, tracks);
      renderFrame(ctx, width, height, tracks, ph);
      onProgress(Math.min(99, Math.round((ph / duration) * 100)));
      if (elapsed >= duration) { resolve(); return; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  // Flush the last frame and stop.
  mediaEngine.pause();
  recorder.stop();
  const webmBlob = await done;
  videoStream.getTracks().forEach(t => t.stop());

  if (format === 'mp4') {
    onStage('Transcoding to MP4…');
    onProgress(0);
    try {
      const mp4 = await transcodeToMp4(webmBlob, p => onProgress(p));
      onStage('Done');
      return { blob: mp4, ext: 'mp4' };
    } catch (err) {
      // Fall back to WebM if transcode is unavailable (e.g. not cross-origin isolated).
      onStage('MP4 unavailable — saved as WebM');
      return { blob: webmBlob, ext: 'webm', warning: String(err.message || err) };
    }
  }

  onStage('Done');
  return { blob: webmBlob, ext: 'webm' };
}
