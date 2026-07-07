console.log('🔧 Shader worker loaded');

// Type definitions for worker messages
interface InitMessage {
  type: 'init';
  width: number;
  height: number;
}

interface ProcessMessage {
  type: 'process';
  bitmap: ImageBitmap;
}

interface ResizeMessage {
  type: 'resize';
  width: number;
  height: number;
}

type WorkerMessage = InitMessage | ProcessMessage | ResizeMessage;

// WebGL resources
let gl: WebGL2RenderingContext | null = null;
let canvas: OffscreenCanvas | null = null;
let program: WebGLProgram | null = null;
let vao: WebGLVertexArrayObject | null = null;
let texture: WebGLTexture | null = null;
let width = 0;
let height = 0;

// Fullscreen quad vertices (position + texCoord)
// Two triangles forming a full-screen quad
const quadVertices = new Float32Array([
  // positions   // texCoords
  -1.0,  1.0,    0.0, 1.0,
  -1.0, -1.0,    0.0, 0.0,
   1.0, -1.0,    1.0, 0.0,
  -1.0,  1.0,    0.0, 1.0,
   1.0, -1.0,    1.0, 0.0,
   1.0,  1.0,    1.0, 1.0,
]);

// Pass-through vertex shader (WebGL2)
const vertexShaderSource = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`;

// Pass-through fragment shader (WebGL2)
const fragmentShaderSource = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_texture;
void main() {
  outColor = texture(u_texture, v_texCoord);
}`;

function compileShader(source: string, type: number): WebGLShader | null {
  if (!gl) return null;
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    console.error('🔧 Shader compile error:', info);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(vsSource: string, fsSource: string): WebGLProgram | null {
  if (!gl) return null;
  const vs = compileShader(vsSource, gl.VERTEX_SHADER);
  const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog);
    console.error('🔧 Program link error:', info);
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

function initGL(w: number, h: number): boolean {
  try {
    canvas = new OffscreenCanvas(w, h);
    gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      console.error('🔧 Failed to create WebGL2 context');
      return false;
    }

    width = w;
    height = h;

    // Create shader program
    program = createProgram(vertexShaderSource, fragmentShaderSource);
    if (!program) return false;

    gl.useProgram(program);

    // Create VAO
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Create VBO with quad vertices
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    // Set up position attribute (stride = 4 floats = 16 bytes)
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);

    // Set up texCoord attribute (stride = 4 floats = 16 bytes, offset = 8 bytes)
    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

    // Create texture
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Set viewport
    gl.viewport(0, 0, width, height);

    console.log('🔧 WebGL2 initialized successfully', { width, height });
    return true;
  } catch (err) {
    console.error('🔧 initGL error:', err);
    return false;
  }
}

function processFrame(bitmap: ImageBitmap): ImageBitmap | null {
  if (!gl || !program || !vao || !texture || !canvas) {
    console.error('🔧 WebGL not initialized');
    return null;
  }

  try {
    // Bind everything
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // Upload the bitmap to texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

    // Set the texture uniform
    const texLoc = gl.getUniformLocation(program, 'u_texture');
    gl.uniform1i(texLoc, 0);

    // Clear and draw
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Read back the result
    const resultBitmap = canvas.transferToImageBitmap();
    return resultBitmap;
  } catch (err) {
    console.error('🔧 processFrame error:', err);
    return null;
  }
}

function resizeGL(w: number, h: number): void {
  if (!gl || !canvas) return;
  width = w;
  height = h;
  canvas.width = w;
  canvas.height = h;
  gl.viewport(0, 0, w, h);
  console.log('🔧 Resized to', { width: w, height: h });
}

// Message handler
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case 'init': {
        console.log('🔧 Received init:', { width: msg.width, height: msg.height });
        const ok = initGL(msg.width, msg.height);
        if (ok) {
          self.postMessage({ type: 'ready' });
        } else {
          self.postMessage({ type: 'error', message: 'Failed to initialize WebGL2' });
        }
        break;
      }

      case 'process': {
        const resultBitmap = processFrame(msg.bitmap);
        if (resultBitmap) {
          // Transfer ownership of the ImageBitmap for performance
          self.postMessage({ type: 'result', bitmap: resultBitmap } as any, { transfer: [resultBitmap] } as any);
        } else {
          self.postMessage({ type: 'error', message: 'Failed to process frame' });
        }
        break;
      }

      case 'resize': {
        resizeGL(msg.width, msg.height);
        break;
      }

      default:
        console.warn('🔧 Unknown message type:', (msg as any).type);
    }
  } catch (err) {
    console.error('🔧 Worker error:', err);
    self.postMessage({ type: 'error', message: String(err) });
  }
};