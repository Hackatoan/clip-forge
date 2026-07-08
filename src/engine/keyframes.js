// Keyframe evaluation. A clip may carry `keyframes: { prop: [{ t, v, ease }] }`
// where `t` is clip-local seconds. When a property is keyframed, the animated
// value overrides the clip's static value.

export const ANIMATABLE = ['opacity', 'scale', 'x', 'y', 'rotation', 'volume'];

function easeFn(kind, f) {
  switch (kind) {
    case 'in':      return f * f;
    case 'out':     return f * (2 - f);
    case 'in-out':  return f < 0.5 ? 2 * f * f : -1 + (4 - 2 * f) * f;
    default:        return f; // linear
  }
}

// Sample a keyframed property at clip-local time `t`. Falls back to `base`
// (the clip's static value) when there are no keyframes.
export function sample(clip, prop, t, base) {
  const arr = clip.keyframes && clip.keyframes[prop];
  if (!arr || arr.length === 0) return base;
  if (arr.length === 1) return arr[0].v;
  if (t <= arr[0].t) return arr[0].v;
  if (t >= arr[arr.length - 1].t) return arr[arr.length - 1].v;
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i], b = arr[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1e-6;
      const f = easeFn(b.ease, (t - a.t) / span);
      return a.v + (b.v - a.v) * f;
    }
  }
  return base;
}

export function hasKeyframes(clip, prop) {
  return !!(clip.keyframes && clip.keyframes[prop] && clip.keyframes[prop].length);
}
