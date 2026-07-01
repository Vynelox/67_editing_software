import { useEffect, useRef } from 'react';
import { vertexShader, fragmentShader } from './glowShader';

export default function GlowOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { 
      alpha: true, 
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false 
    });
    if (!gl) return;

    // Resize canvas to window size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl!.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    // Compile shaders
    function compileShader(source: string, type: number) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compileShader(vertexShader, gl.VERTEX_SHADER);
    const fs = compileShader(fragmentShader, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl!.attachShader(program, vs);
    gl!.attachShader(program, fs);
    gl!.linkProgram(program);
    if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) {
      console.error(gl!.getProgramInfoLog(program));
      return;
    }
    gl!.useProgram(program);

    // Create fullscreen quad geometry
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    const buffer = gl!.createBuffer();
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
    gl!.bufferData(gl!.ARRAY_BUFFER, vertices, gl!.STATIC_DRAW);

    const positionLoc = gl!.getAttribLocation(program, 'position');
    gl!.enableVertexAttribArray(positionLoc);
    gl!.vertexAttribPointer(positionLoc, 2, gl!.FLOAT, false, 0, 0);

    // Set up uniforms
    const uTimeLoc = gl!.getUniformLocation(program, 'u_time');
    const uniforms = { u_time: 0 };

    // Enable blending for transparency
    gl!.enable(gl!.BLEND);
    gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE_MINUS_SRC_ALPHA);

    // Animation loop
    let startTime = performance.now();
    let animationId: number;

    const render = () => {
      uniforms.u_time = (performance.now() - startTime) / 1000;
      
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      
      gl!.uniform1f(uTimeLoc, uniforms.u_time);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      
      animationId = requestAnimationFrame(render);
    };
    render();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resize);
      if (animationId) cancelAnimationFrame(animationId);
      gl!.deleteProgram(program);
      gl!.deleteShader(vs);
      gl!.deleteShader(fs);
      gl!.deleteBuffer(buffer);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 9999,
      pointerEvents: 'none',
      mixBlendMode: 'screen'
    }}>
      <canvas
        ref={canvasRef}
        style={{
          background: 'transparent',
          width: '100vw',
          height: '100vh'
        }}
      />
    </div>
  );
}