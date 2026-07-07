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
    container.appendChild(renderer.domElement);

    // DEBUG: Render solid red to verify canvas is visible
    renderer.setClearColor(0xff0000, 1); // Opaque red
    const debugAnimate = () => {
      requestAnimationFrame(debugAnimate);
      renderer.render(scene, camera); // Use renderer directly, not composer
    };
    debugAnimate();

    // Start screen capture
    const startCapture = async () => {
      try {
        const { sourceId } = await (window as any).electronAPI.startWindowCapture();
        const stream = await (window as any).electronAPI.getCaptureStream(sourceId);
        
        video.srcObject = stream;
        await video.play();

        // Create video texture
        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;

        // Create fullscreen plane with the video texture
        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshBasicMaterial({ 
          map: videoTexture,
          transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // Setup bloom post-processing
        const composer = new EffectComposer(renderer);
        composerRef.current = composer;

        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          0.8,   // strength
          0.5,   // radius
          0.3    // threshold
        );
        composer.addPass(bloomPass);

        // OutputPass handles color space conversion and tone mapping
        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        // Animation loop
        const animate = () => {
          requestAnimationFrame(animate);
          composer.render();
        };
        animate();

      } catch (err) {
        console.error('Bloom capture failed:', err);
      }
    };

    // startCapture(); // DEBUG: commented out for solid red canvas test

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
        zIndex: 1,
        mixBlendMode: 'screen'
      }}
    >
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
    </div>
  );
}