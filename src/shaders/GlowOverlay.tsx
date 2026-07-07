import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export default function GlowOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const composerRef = useRef<EffectComposer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

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
    renderer.setClearColor(0x000000, 0); // Black with 0 alpha (fully transparent)
    container.appendChild(renderer.domElement);

    // Start screen capture
    const startCapture = async () => {
      try {
        console.log('🔍 Starting capture...');
        const { sourceId } = await (window as any).electronAPI.startWindowCapture();
        console.log('🔍 Got sourceId:', sourceId);
        
        // Call getUserMedia directly in the renderer
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // @ts-ignore
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080
            }
          }
        });
        
        console.log('🔍 Got stream:', stream);
        console.log('🔍 Stream tracks:', stream.getTracks());
        
        video.srcObject = stream;
        await video.play();
        console.log('🔍 Video play() succeeded');
        
        // Create video texture
        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshBasicMaterial({ 
          map: videoTexture,
          transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // Setup bloom post-processing with EXTREME settings
        const composer = new EffectComposer(renderer);
        composerRef.current = composer;

        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          1.0,   // strength - EXTREME
          0.002,   // radius - EXTREME
          1.0    // threshold - 0 means EVERYTHING blooms
        );
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        // Render WITH composer
        const animate = () => {
          requestAnimationFrame(animate);
          composer.render();
        };
        animate();

        console.log('🔍 Step 3: Bloom should be EXTREME - massive white glow everywhere');

      } catch (err) {
        console.error('Bloom capture failed:', err);
      }
    };

    startCapture();

    // Handle resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      composerRef.current?.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      renderer.dispose();
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
        zIndex: 1, // Lower z-index so it doesn't capture itself
        mixBlendMode: 'screen', // Use screen blend mode
        border: 'none'
      }}
    >
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
    </div>
  );
}