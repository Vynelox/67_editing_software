import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { domToCanvas } from 'modern-screenshot';

export default function GlowOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const latestBitmapRef = useRef<ImageBitmap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use HALF resolution for performance
    const CAPTURE_SCALE = 1;
    let captureWidth = Math.floor(window.innerWidth * CAPTURE_SCALE);
    let captureHeight = Math.floor(window.innerHeight * CAPTURE_SCALE);

    // Create worker using new URL() for Vite compatibility
    const worker = new Worker(
      new URL('../workers/shaderWorker.ts', import.meta.url),
      { type: 'module' }
    );

    // Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: false,
      premultipliedAlpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Create a placeholder texture that will be updated by worker results
    const placeholderCanvas = new OffscreenCanvas(captureWidth, captureHeight);
    placeholderCanvas.getContext('2d');
    const texture = new THREE.Texture(placeholderCanvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    textureRef.current = texture;

    // Fullscreen quad with the texture - match aspect ratio to prevent distortion
    const aspectRatio = captureWidth / captureHeight;
    const geometry = new THREE.PlaneGeometry(aspectRatio, aspectRatio);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      transparent: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Setup EffectComposer (just RenderPass + OutputPass for now, bloom in Step 3)
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      composer.render();
    };
    animate();

    // Capture loop
    let isCapturing = false;

    const captureLoop = async () => {
      if (isCapturing) {
        requestAnimationFrame(captureLoop);
        return;
      }
      
      try {
        isCapturing = true;
        
        console.log('🔍 modern-screenshot capture started');
        
        // Capture DOM using modern-screenshot
        const appShell = document.querySelector('.app-shell');
        if (!appShell) {
          throw new Error('.app-shell element not found');
        }
        
        const canvas = await domToCanvas(appShell as HTMLElement, {
          width: captureWidth,
          height: captureHeight,
          scale: 1,
        });
        
        console.log('🔍 Capture completed, sending to worker');
        
        // Convert to ImageBitmap
        const bitmap = await createImageBitmap(canvas);
        canvas.remove();
        
        // Send to worker (transfer ownership)
        worker.postMessage(
          { type: 'process', bitmap },
          [bitmap]
        );
      } catch (err) {
        console.error('🔍 Capture error:', err);
      } finally {
        isCapturing = false;
      }
      
      requestAnimationFrame(captureLoop);
    };

    // Worker message handler
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      
      if (msg.type === 'ready') {
        console.log('🔧 Worker ready, starting capture loop');
        captureLoop();
      } else if (msg.type === 'result') {
        console.log('🔍 Received result bitmap:', msg.bitmap?.width, 'x', msg.bitmap?.height);
        
        // Store the bitmap to prevent garbage collection
        if (latestBitmapRef.current) {
          latestBitmapRef.current.close();
        }
        latestBitmapRef.current = msg.bitmap;
        
        if (textureRef.current && msg.bitmap) {
          textureRef.current.image = msg.bitmap;
          textureRef.current.needsUpdate = true;
          console.log('🔍 Texture updated, needsUpdate:', textureRef.current.needsUpdate);
        }
      } else if (msg.type === 'error') {
        console.error('🔧 Worker error:', msg.message);
      }
    };

    worker.onerror = (err) => {
      console.error('🔧 Worker error event:', err);
    };

    // Initialize worker
    worker.postMessage({ type: 'init', width: captureWidth, height: captureHeight });

    // Handle resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      captureWidth = Math.floor(width * CAPTURE_SCALE);
      captureHeight = Math.floor(height * CAPTURE_SCALE);
      
      renderer.setSize(width, height);
      composer.setSize(width, height);
      
      worker.postMessage({ type: 'resize', width: captureWidth, height: captureHeight });
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      worker.terminate();
      if (latestBitmapRef.current) {
        latestBitmapRef.current.close();
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
        mixBlendMode: 'screen'
      }}
    />
  );
}