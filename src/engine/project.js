// Project save / load. Serialises the timeline to a self-contained
// `.clipforge.json` file with all media embedded as data URLs, so a project
// survives reloads and can be shared as a single file (no server needed).

const FILE_VERSION = 1;

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

async function srcToDataURL(src) {
  if (!src || src.startsWith('data:')) return src;
  const blob = await fetch(src).then(r => r.blob());
  return blobToDataURL(blob);
}

function dataURLToObjectURL(dataUrl) {
  // Convert an embedded data URL back into a blob object URL for playback.
  const [meta, b64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(meta)?.[1] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

// Serialise current state to a JSON string (async — encodes media).
export async function serializeProject(state, onProgress) {
  const mediaClips = [];
  for (const t of state.tracks) for (const c of t.clips) if (c.src) mediaClips.push(c);
  let done = 0;

  const tracks = [];
  for (const t of state.tracks) {
    const clips = [];
    for (const c of t.clips) {
      if (c.src) {
        clips.push({ ...c, src: await srcToDataURL(c.src) });
        done++;
        onProgress?.(Math.round((done / Math.max(1, mediaClips.length)) * 100));
      } else {
        clips.push({ ...c });
      }
    }
    tracks.push({ ...t, clips });
  }

  return JSON.stringify({
    version: FILE_VERSION,
    app: 'clip-forge',
    aspect: state.aspect,
    canvasW: state.canvasW,
    canvasH: state.canvasH,
    tracks,
  });
}

export function downloadProject(json, name = 'project.clipforge.json') {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Parse a loaded project file and rehydrate media data URLs into object URLs.
export function parseProject(json) {
  const proj = JSON.parse(json);
  if (proj.app !== 'clip-forge') throw new Error('Not a Clip Forge project file.');
  const tracks = proj.tracks.map(t => ({
    ...t,
    clips: t.clips.map(c => (c.src && c.src.startsWith('data:'))
      ? { ...c, src: dataURLToObjectURL(c.src) }
      : { ...c }),
  }));
  return { ...proj, tracks };
}
