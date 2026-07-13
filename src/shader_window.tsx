/**
 * Overlay Window Entry Point
 * 
 * This is loaded by overlay.html in Window B (the transparent overlay).
 * It sets up a WebGL2 canvas that receives raw pixel data from the main process
 * via IPC and renders it through a GLSL shader.
 */

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
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Overlay shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
  const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Overlay program link error:', gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

function main() {
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

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: false,  // Disable alpha premultiplication
    preserveDrawingBuffer: false,
    antialias: false
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
  const uTextureLoc = gl.getUniformLocation(program, 'u_texture');
  const uResolutionLoc = gl.getUniformLocation(program, 'u_resolution');
  const uTimeLoc = gl.getUniformLocation(program, 'u_time');  // Elapsed time in miliseconds
  console.log('Overlay: Shader program created successfully');


  // Set canvas pixel size to window size
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.useProgram(program);
    gl!.uniform2f(uResolutionLoc, canvas.width, canvas.height);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);


  // Create VAO and VBO
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);

  const texLoc = gl.getAttribLocation(program, 'a_texCoord');
  gl.enableVertexAttribArray(texLoc);
  gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

  // Create texture for incoming frames
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let textureWidth = 1;
  let textureHeight = 1;

  // Get uniform location
  

  

  // Listen for incoming frames from main process
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = (window as any).electronAPI;
  if (api && typeof api.onFrameData === 'function') {
    console.log('Overlay: electronAPI.onFrameData registered');
    api.onFrameData((buffer: ArrayBuffer, width: number, height: number) => {
      const bufferArray = new Uint8Array(buffer);
      
      // Re-allocate texture if size changed
      if (width !== textureWidth || height !== textureHeight) {
        textureWidth = width;
        textureHeight = height;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }

      // Upload pixel data to texture
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);  // Tell WebGL pixels are premultiplied
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bufferArray);

      // Clear and render (texture upscales to fill screen)
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uTextureLoc, 0);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Track start time for u_time
      const time = performance.now() / 1000.0;  // Convert to seconds
      gl.uniform1f(uTimeLoc, time);

    });
  } else {
    console.error('Overlay: electronAPI.onFrameData not available');
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}