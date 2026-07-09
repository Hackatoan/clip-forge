// GPU chroma key via WebGL. Uploads the source frame as a texture and keys
// out the colour in a fragment shader — far faster than per-pixel JS.
// Results are cached per clip so static content (images, paused video) isn't
// reprocessed every frame. Falls back to null if WebGL is unavailable.

let gl, program, canvas, loc, quadBuf;
let initTried = false;
const cache = new Map(); // clipId -> { canvas, sig, time }

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, a_pos.y * 0.5 + 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec3 u_key;
uniform float u_sim;
uniform float u_smooth;
varying vec2 v_uv;
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  float d = distance(c.rgb, u_key);
  float a = smoothstep(u_sim, u_sim + max(u_smooth, 0.001), d);
  gl_FragColor = vec4(c.rgb, c.a * a);
}`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function init() {
  if (initTried) return !!gl;
  initTried = true;
  try {
    canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (!gl) return false;
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    gl.useProgram(program);
    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    loc = {
      key: gl.getUniformLocation(program, 'u_key'),
      sim: gl.getUniformLocation(program, 'u_sim'),
      smooth: gl.getUniformLocation(program, 'u_smooth'),
    };
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    return true;
  } catch {
    gl = null;
    return false;
  }
}

function hexToRgb01(hex) {
  const n = parseInt((hex || '#00ff00').slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Returns a canvas with the key removed, or null if GPU path unavailable.
// `frameTime` lets us cache static frames (image = 0, video = currentTime).
export function chromaProcessGL(clipId, srcEl, sw, sh, chroma, frameTime) {
  if (!init()) return null;

  const [kr, kg, kb] = hexToRgb01(chroma.color);
  const sim = (chroma.similarity ?? 0.4) * 1.732;
  const smooth = (chroma.smoothness ?? 0.1) * 1.732;
  const sig = `${chroma.color}|${sim}|${smooth}|${sw}x${sh}`;

  const cached = cache.get(clipId);
  if (cached && cached.sig === sig && cached.time === frameTime) return cached.canvas;

  if (canvas.width !== sw || canvas.height !== sh) { canvas.width = sw; canvas.height = sh; }
  gl.viewport(0, 0, sw, sh);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcEl);
  } catch { return null; }
  gl.uniform3f(loc.key, kr, kg, kb);
  gl.uniform1f(loc.sim, sim);
  gl.uniform1f(loc.smooth, smooth);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Copy into a per-clip 2d canvas so concurrent clips don't overwrite the
  // single GL framebuffer before they're drawn onto the main canvas.
  let out = cached?.canvas;
  if (!out) { out = document.createElement('canvas'); }
  if (out.width !== sw || out.height !== sh) { out.width = sw; out.height = sh; }
  const octx = out.getContext('2d');
  octx.clearRect(0, 0, sw, sh);
  octx.drawImage(canvas, 0, 0);
  cache.set(clipId, { canvas: out, sig, time: frameTime });
  return out;
}
