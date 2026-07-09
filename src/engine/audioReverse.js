// Reverse an audio source: decode, reverse each channel, re-encode to WAV,
// and return a new object URL. Used by the "Reverse" action on audio clips.

function encodeWav(audio) {
  const ch = audio.numberOfChannels;
  const rate = audio.sampleRate;
  const frames = audio.length;
  const buffer = new ArrayBuffer(44 + frames * ch * 2);
  const view = new DataView(buffer);
  const w = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  w(0, 'RIFF'); view.setUint32(4, 36 + frames * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * ch * 2, true);
  view.setUint16(32, ch * 2, true); view.setUint16(34, 16, true);
  w(36, 'data'); view.setUint32(40, frames * ch * 2, true);

  const chans = [];
  for (let c = 0; c < ch; c++) chans.push(audio.getChannelData(c));
  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      let s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function reverseAudio(src) {
  const buf = await fetch(src).then(r => r.arrayBuffer());
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const audio = await ctx.decodeAudioData(buf.slice(0));
  for (let c = 0; c < audio.numberOfChannels; c++) audio.getChannelData(c).reverse();
  ctx.close?.();
  return URL.createObjectURL(encodeWav(audio));
}
