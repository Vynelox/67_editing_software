console.log('🔧 Shader worker loaded');

// Bloom parameters
const BLOOM_THRESHOLD = 0.5; // Only pixels brighter than 50% get bloom
const BLOOM_STRENGTH = 1.5; // Moderate bloom intensity

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
let width = 0;
let height = 0;

// Shader programs
let brightPassProgram: WebGLProgram | null = null;
let blurProgram: WebGLProgram | null = null;
let compositeProgram: WebGLProgram | null = null;

// Framebuffers
let inputTexture: WebGLTexture | null = null;
let brightFBO: { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null = null;
let blurHFBO: { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null = null;
let blurVFBO: { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null = null;
let finalFBO: { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null = null;

// VAO and VBO
let vao: WebGLVertexArrayObject | null = null;
let vbo: WebGLBuffer | null = null;

// Fullscreen quad vertices (position + texCoord) - using TRIANGLE_STRIP
const quadVertices = new Float32Array([
  -1.0,  1.0,    0.0, 1.0,
  -1.0, -1.0,    0.0, 0.0,
   1.0,  1.0,    1.0, 1.0,
   1.0, -1.0,    1.0, 0.0,
]);

// Vertex shader (shared by all passes)
const vertexShaderSource = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`;

// Bright pass fragment shader
const brightPassFragSource = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_texture;
uniform float u_threshold;
void main() {
  vec4 color = texture(u_texture, v_texCoord);
  float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  if (brightness > u_threshold) {
    outColor = color;
  } else {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
}`;

// Gaussian blur fragment shader (9-tap, direction via uniform)
const blurFragSource = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_texture;
uniform vec2 u_direction;
uniform vec2 u_resolution;
void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 result = vec4(0.0);
  float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  result += texture(u_texture, v_texCoord) * weights[0];
  for (int i = 1; i < 5; i++) {
    vec2 offset = u_direction * texelSize * float(i);
    result += texture(u_texture, v_texCoord + offset) * weights[i];
    result += texture(u_texture, v_texCoord - offset) * weights[i];
  }
  outColor = result;
}`;

// Composite fragment shader
const compositeFragSource = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_original;
uniform sampler2D u_bloom;
uniform float u_strength;
void main() {
  vec4 original = texture(u_original, v_texCoord);
  vec4 bloom = texture(u_bloom, v_texCoord);
  outColor = original + bloom * u_strength;
}`;

function compileShader(source: string, type: number, name: string): WebGLShader | null {
  if (!gl) return null;
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    console.error(`🔧 [Worker] ${name} shader compile error:`, info);
    gl.deleteShader(shader);
    return null;
  }
  console.log(`🔧 [Worker] ${name} shader compiled successfully`);
  return shader;
}

function createProgram(vsSource: string, fsSource: string, name: string): WebGLProgram | null {
  if (!gl) return null;
  console.log(`🔧 [Worker] Creating ${name} program...`);
  const vs = compileShader(vsSource, gl.VERTEX_SHADER, `${name} vertex`);
  const fs = compileShader(fsSource, gl.FRAGMENT_SHADER, `${name} fragment`);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog);
    console.error(`🔧 [Worker] ${name} program link error:`, info);
    gl.deleteProgram(prog);
    return null;
  }
  console.log(`🔧 [Worker] ${name} program linked successfully`);
  return prog;
}

function createFramebuffer(w: number, h: number, name: string): { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null {
  if (!gl) return null;
  console.log(`🔧 [Worker] Creating ${name} FBO (${w}x${h})...`);
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) return null;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    console.error(`🔧 [Worker] ${name} FBO incomplete:`, status);
    return null;
  }
  
  console.log(`🔧 [Worker] ${name} FBO created successfully`);
  return { framebuffer, texture: tex };
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
      console.error('🔧 [Worker] Failed to create WebGL2 context');
      return false;
    }

    width = w;
    height = h;
    console.log(`🔧 [Worker] WebGL2 context created (${w}x${h})`);

    // Create shader programs
    brightPassProgram = createProgram(vertexShaderSource, brightPassFragSource, 'brightPass');
    blurProgram = createProgram(vertexShaderSource, blurFragSource, 'blur');
    compositeProgram = createProgram(vertexShaderSource, compositeFragSource, 'composite');
    
    if (!brightPassProgram || !blurProgram || !compositeProgram) {
      console.error('🔧 [Worker] Failed to create shader programs');
      return false;
    }

    // Create VAO and VBO
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    // Set up position attribute (stride = 4 floats = 16 bytes)
    const posLoc = gl.getAttribLocation(brightPassProgram, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);

    // Set up texCoord attribute (stride = 4 floats = 16 bytes, offset = 8 bytes)
    const texLoc = gl.getAttribLocation(brightPassProgram, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

    // Create input texture
    inputTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create framebuffers at full resolution for debugging
    brightFBO = createFramebuffer(w, h, 'bright');
    blurHFBO = createFramebuffer(w, h, 'blurH');
    blurVFBO = createFramebuffer(w, h, 'blurV');
    finalFBO = createFramebuffer(w, h, 'final');

    if (!brightFBO || !blurHFBO || !blurVFBO || !finalFBO) {
      console.error('🔧 [Worker] Failed to create framebuffers');
      return false;
    }

    // Set viewport
    gl.viewport(0, 0, width, height);

    console.log('🔧 [Worker] Bloom shaders initialized', { width, height });
    return true;
  } catch (err) {
    console.error('🔧 [Worker] initGL error:', err);
    return false;
  }
}

function resizeGL(w: number, h: number): void {
  if (!gl || !canvas) return;
  width = w;
  height = h;
  canvas.width = w;
  canvas.height = h;
  gl.viewport(0, 0, w, h);

  brightFBO = createFramebuffer(w, h, 'bright');
  blurHFBO = createFramebuffer(w, h, 'blurH');
  blurVFBO = createFramebuffer(w, h, 'blurV');
  finalFBO = createFramebuffer(w, h, 'final');

  console.log('🔧 [Worker] Resized to', { width: w, height: h });
}

// Message handler
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    switch (msg.type) {
      case 'init': {
        console.log('🔧 [Worker] Received init:', { width: msg.width, height: msg.height });
        const ok = initGL(msg.width, msg.height);
        if (ok) {
          self.postMessage({ type: 'ready' });
        } else {
          self.postMessage({ type: 'error', message: 'Failed to initialize WebGL2' });
        }
        break;
      }

      case 'process': {
        console.log('🔧 [Worker] Received frame for processing');
        
        if (!gl || !brightPassProgram || !blurProgram || !compositeProgram) {
          console.error('🔧 [Worker] WebGL not initialized');
          self.postMessage({ type: 'error', message: 'WebGL not initialized' });
          return;
        }
        if (!brightFBO || !blurHFBO || !blurVFBO || !finalFBO) {
          console.error('🔧 [Worker] Framebuffers not initialized');
          self.postMessage({ type: 'error', message: 'Framebuffers not initialized' });
          return;
        }

        const bitmap = msg.bitmap;
        console.log('🔧 [Worker] Bitmap size:', bitmap.width, 'x', bitmap.height);
        
        // 1. Upload to texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
        console.log('🔧 [Worker] Uploaded bitmap to texture');
        
        // 2. Bright pass
        gl.bindFramebuffer(gl.FRAMEBUFFER, brightFBO.framebuffer);
        gl.viewport(0, 0, width, height);
        gl.useProgram(brightPassProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(gl.getUniformLocation(brightPassProgram, 'u_texture'), 0);
        gl.uniform1f(gl.getUniformLocation(brightPassProgram, 'u_threshold'), BLOOM_THRESHOLD);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        console.log('🔧 [Worker] Bright pass completed');
        
        // Check if bright pass produced output
        gl.bindFramebuffer(gl.FRAMEBUFFER, brightFBO.framebuffer);
        const brightPixels = new Uint8Array(4);
        gl.readPixels(Math.floor(width/2), Math.floor(height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, brightPixels);
        console.log('🔧 [Worker] Bright pass center pixel:', Array.from(brightPixels));
        
        // 3. Horizontal blur
        gl.bindFramebuffer(gl.FRAMEBUFFER, blurHFBO.framebuffer);
        gl.viewport(0, 0, width, height);
        gl.useProgram(blurProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, brightFBO.texture);
        gl.uniform1i(gl.getUniformLocation(blurProgram, 'u_texture'), 0);
        gl.uniform2f(gl.getUniformLocation(blurProgram, 'u_direction'), 1.0, 0.0);
        gl.uniform2f(gl.getUniformLocation(blurProgram, 'u_resolution'), width, height);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        console.log('🔧 [Worker] Horizontal blur completed');
        
        // 4. Vertical blur
        gl.bindFramebuffer(gl.FRAMEBUFFER, blurVFBO.framebuffer);
        gl.viewport(0, 0, width, height);
        gl.useProgram(blurProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, blurHFBO.texture);
        gl.uniform1i(gl.getUniformLocation(blurProgram, 'u_texture'), 0);
        gl.uniform2f(gl.getUniformLocation(blurProgram, 'u_direction'), 0.0, 1.0);
        gl.uniform2f(gl.getUniformLocation(blurProgram, 'u_resolution'), width, height);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        console.log('🔧 [Worker] Vertical blur completed');
        
        // Check if blur produced output
        gl.bindFramebuffer(gl.FRAMEBUFFER, blurVFBO.framebuffer);
        const blurPixels = new Uint8Array(4);
        gl.readPixels(Math.floor(width/2), Math.floor(height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, blurPixels);
        console.log('🔧 [Worker] Blur center pixel:', Array.from(blurPixels));
        
        // 5. Composite
        gl.bindFramebuffer(gl.FRAMEBUFFER, finalFBO.framebuffer);
        gl.viewport(0, 0, width, height);
        gl.useProgram(compositeProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_original'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, blurVFBO.texture);
        gl.uniform1i(gl.getUniformLocation(compositeProgram, 'u_bloom'), 1);
        gl.uniform1f(gl.getUniformLocation(compositeProgram, 'u_strength'), BLOOM_STRENGTH);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        console.log('🔧 [Worker] Composite completed');
        
        // Check final output
        gl.bindFramebuffer(gl.FRAMEBUFFER, finalFBO.framebuffer);
        const finalPixels = new Uint8Array(4);
        gl.readPixels(Math.floor(width/2), Math.floor(height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, finalPixels);
        console.log('🔧 [Worker] Final center pixel:', Array.from(finalPixels));
        
        // 6. Read result and send back
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
        const resultCanvas = new OffscreenCanvas(width, height);
        const ctx = resultCanvas.getContext('2d');
        if (!ctx) {
          self.postMessage({ type: 'error', message: 'Failed to get 2D context' });
          return;
        }
        const imageData = new ImageData(new Uint8ClampedArray(pixels.buffer), width, height);
        ctx.putImageData(imageData, 0, 0);
        const resultBitmap = resultCanvas.transferToImageBitmap();
        
        console.log('🔧 [Worker] Sending result back to main thread');
        
        self.postMessage(
          { type: 'result', bitmap: resultBitmap } as any,
          { transfer: [resultBitmap] } as any
        );
        break;
      }

      case 'resize': {
        resizeGL(msg.width, msg.height);
        break;
      }

      default:
        console.warn('🔧 [Worker] Unknown message type:', (msg as any).type);
    }
  } catch (err) {
    console.error('🔧 [Worker] Error:', err);
    self.postMessage({ type: 'error', message: String(err) });
  }
};