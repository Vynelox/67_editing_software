/**
 * Overlay Window Entry Point
 * 
 * This is loaded by overlay.html in Window B (the transparent overlay).
 * It sets up a WebGL2 canvas that receives raw pixel data from the app window
 * via getUserMedia and MediaStreamTrackProcessor, then renders it through a GLSL shader.
 * 
 * OPTIMIZED PIPELINE:
 * - No VP8 encode/decode
 * - No IPC chunk forwarding
 * - Direct capture → VideoFrame → WebGL texture
 */

// Web APIs not yet in TypeScript standard library
declare class MediaStreamTrackProcessor {
  readonly track: MediaStreamTrack;
  readonly readable: ReadableStream<VideoFrame>;
  constructor(options: { track: MediaStreamTrack });
}

import VERTEX_SOURCE from './shaders/main.vert?raw';
import FRAGMENT_SOURCE from './shaders/main.frag?raw';

// Fullscreen quad vertices (position + texCoord) using TRIANGLE_STRIP
const QUAD_VERTICES = new Float32Array([
  -1.0,  1.0,    0.0, 0.0,  // top-left
  -1.0, -1.0,    0.0, 1.0,  // bottom-left
   1.0,  1.0,    1.0, 0.0,  // top-right
   1.0, -1.0,    1.0, 1.0,  // bottom-right
]);

function compileShader(gl: WebGL2RenderingContext, source: string, type: number): WebGLShader | null {
  const shader = gl!.createShader(type);
  if (!shader) return null;
  gl!.shaderSource(shader, source);
  gl!.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
    console.error('Overlay shader compile error:', gl!.getShaderInfoLog(shader));
    gl!.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
  const vs = compileShader(gl, vsSource, gl!.VERTEX_SHADER);
  const fs = compileShader(gl, fsSource, gl!.FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const prog = gl!.createProgram();
  if (!prog) return null;
  gl!.attachShader(prog, vs);
  gl!.attachShader(prog, fs);
  gl!.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl!.LINK_STATUS)) {
    console.error('Overlay program link error:', gl!.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

async function main() {
  const root = document.getElementById('root');
  if (!root) {
    console.error('Overlay: No root element found');
    return;
  }

  // Create full-screen canvas
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  root.appendChild(canvas);

  // 🔥 Fallback background to prove the window is alive
  canvas.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    antialias: true
  });
  if (!gl) {
    console.error('Overlay: Failed to create WebGL2 context');
    return;
  }

  console.log('Overlay: WebGL2 context created successfully');

  // Create shader program
  const program = createProgram(gl, VERTEX_SOURCE, FRAGMENT_SOURCE);
  if (!program) {
    console.error('Overlay: Failed to create shader program');
    return;
  }
  const uTextureLoc = gl!.getUniformLocation(program, 'u_texture');
  const uResolutionLoc = gl!.getUniformLocation(program, 'u_resolution');
  const uTimeLoc = gl!.getUniformLocation(program, 'u_time');
  console.log('Overlay: Shader program created successfully');

  // Set canvas pixel size to window size
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.useProgram(program);
    gl!.uniform2f(uResolutionLoc, canvas.width, canvas.height);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Create VAO and VBO
  const vao = gl!.createVertexArray();
  gl!.bindVertexArray(vao);

  const vbo = gl!.createBuffer();
  gl!.bindBuffer(gl!.ARRAY_BUFFER, vbo);
  gl!.bufferData(gl!.ARRAY_BUFFER, QUAD_VERTICES, gl!.STATIC_DRAW);

  const posLoc = gl!.getAttribLocation(program, 'a_position');
  gl!.enableVertexAttribArray(posLoc);
  gl!.vertexAttribPointer(posLoc, 2, gl!.FLOAT, false, 16, 0);

  const texLoc = gl!.getAttribLocation(program, 'a_texCoord');
  gl!.enableVertexAttribArray(texLoc);
  gl!.vertexAttribPointer(texLoc, 2, gl!.FLOAT, false, 16, 8);

  // Create texture for incoming frames
  const texture = gl!.createTexture();
  gl!.bindTexture(gl!.TEXTURE_2D, texture);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.NEAREST);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.NEAREST);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
  gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);

  let textureWidth = 1;
  let textureHeight = 1;

  // Notify main process we're ready
  const api = (window as any).electronAPI;
  if (api) {
    console.log('Overlay: Notifying main process that shader window is ready...');
    api.notifyShaderWindowReady();
  } else {
    console.error('Overlay: electronAPI not available');
    return;
  }

  // Step 1: Get window source ID from main process
  const sourceId = await api.getWindowSourceId();
  if (!sourceId) {
    console.error('Overlay: Failed to get window source ID');
    return;
  }
  console.log('Overlay: Got window source ID:', sourceId);

  // Step 2: Create MediaStream using getUserMedia with the source ID
  console.log('Overlay: Creating MediaStream from desktop capture...');
  // Note: The chromeMediaSource constraints are Electron-specific
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      chromeMediaSource: 'desktop' as any,
      chromeMediaSourceId: sourceId,
    },
  } as any);
  console.log('Overlay: MediaStream created, track count:', stream.getVideoTracks().length);

  // Step 3: Create MediaStreamTrackProcessor to get VideoFrames
  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    console.error('Overlay: No video track in stream');
    stream.getTracks().forEach(t => t.stop());
    return;
  }

  const processor = new MediaStreamTrackProcessor({ track: videoTrack });
  const reader = processor.readable.getReader();
  console.log('Overlay: MediaStreamTrackProcessor created');

  // Step 4: Process VideoFrames and upload to WebGL
  let stopped = false;
  async function readLoop() {
    while (!stopped) {
      try {
        const { value, done } = await reader.read();
        if (done || !value) break;

        const frame = value as VideoFrame;

        // Re-allocate texture if size changed
        if (frame.displayWidth !== textureWidth || frame.displayHeight !== textureHeight) {
          textureWidth = frame.displayWidth;
          textureHeight = frame.displayHeight;
          gl!.bindTexture(gl!.TEXTURE_2D, texture);
          gl!.pixelStorei(gl!.UNPACK_ALIGNMENT, 1);
          gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, textureWidth, textureHeight, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
          console.log('Overlay: Texture resized to', textureWidth, 'x', textureHeight);
        }

        // Upload VideoFrame directly to WebGL texture (GPU-to-GPU, zero-copy)
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, frame);

        // Clear and render
        gl!.clearColor(0, 0, 0, 0);
        gl!.clear(gl!.COLOR_BUFFER_BIT);
        gl!.useProgram(program);
        gl!.activeTexture(gl!.TEXTURE0);
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.uniform1i(uTextureLoc, 0);
        gl!.bindVertexArray(vao);
        gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

        const time = performance.now() / 1000.0;
        gl!.uniform1f(uTimeLoc, time);

        console.log('Overlay: VideoFrame uploaded to WebGL, size:', textureWidth, 'x', textureHeight);

        // Close the frame to release GPU memory
        frame.close();
      } catch (e) {
        if (!stopped) {
          console.error('Overlay readLoop error:', e);
        }
        break;
      }
    }
  }

  readLoop();

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    stopped = true;
    reader.cancel();
    videoTrack.stop();
    stream.getTracks().forEach(t => t.stop());
    if (vao) gl!.deleteVertexArray(vao);
    if (vbo) gl!.deleteBuffer(vbo);
    if (texture) gl!.deleteTexture(texture);
    if (program) gl!.deleteProgram(program);
  });
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
