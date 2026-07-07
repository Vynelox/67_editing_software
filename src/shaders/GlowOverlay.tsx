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

    // Start screen capture
    const startCapture = async () => {
      try {
        console.log('🔍 Starting capture...');
        const { sourceId } = await (window as any).electronAPI.startWindowCapture();
        console.log('🔍 Got sourceId:', sourceId);
        
        const stream = await (window as any).electronAPI.getCaptureStream(sourceId);
        console.log('🔍 Got stream:', stream);
        console.log('🔍 Stream tracks:', stream.getTracks());
        
        video.srcObject = stream;
        await video.play();
        console.log('🔍 Video play() succeeded');
        
        // Check video state after a delay
        setTimeout(() => {
          console.log('🔍 Video state after 1 second:');
          console.log('  - readyState:', video.readyState);
          console.log('  - videoWidth:', video.videoWidth);
          console.log('  - videoHeight:', video.videoHeight);
          console.log('  - paused:', video.paused);
          console.log('  - currentTime:', video.currentTime);
          console.log('  - srcObject:', video.srcObject);
          
          if (video.readyState >= 2) {
            console.log('✅ Video has frames!');
          } else {
            console.log('❌ Video has NO frames - readyState < 2');
          }
        }, 1000);

        // Create video texture
        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshBasicMaterial({ 
          map: videoTexture,
          transparent: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const animate = () => {
          requestAnimationFrame(animate);
          renderer.render(scene, camera);
        };
        animate();

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
        zIndex: 9998, // Lower than the debug video
        mixBlendMode: 'normal',
        border: '3px solid blue'
      }}
    >
      <video 
        ref={videoRef} 
        style={{ 
          position: 'fixed',
          top: '10px',
          right: '10px',
          width: '320px',
          height: '180px',
          zIndex: 99999,
          border: '3px solid red',
          background: 'black'
        }} 
        playsInline 
        muted 
      />
    </div>
  );
}