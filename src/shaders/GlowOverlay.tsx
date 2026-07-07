import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
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

    // Start screen capture using element.captureStream()
    const startCapture = async () => {
      try {
        console.log('🔍 Starting capture...');
        
        // Get the editor container element (outside GlowOverlay)
        const editorContainer = document.getElementById('editor-container');
        if (!editorContainer) {
          throw new Error('Editor container not found');
        }
        
        // Capture only the editor container (not the GlowOverlay canvas)
        // @ts-ignore - captureStream is not in standard TypeScript types
        const stream = editorContainer.captureStream({
          video: {
            frameRate: 60
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

        // Setup bloom post-processing
        const composer = new EffectComposer(renderer);
        composerRef.current = composer;

        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          1.5,   // strength
          0.5,   // radius
          0.0    // threshold
        );
        composer.addPass(bloomPass);

        // Custom shader to make dark areas transparent (breaks feedback loop)
        const bloomOnlyShader = {
          uniforms: {
            tDiffuse: { value: null },
            threshold: { value: 0.8 }
          },
          vertexShader: `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float threshold;
            varying vec2 vUv;
            
            void main() {
              vec4 color = texture2D(tDiffuse, vUv);
              // Calculate brightness using luminance formula
              float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
              
              // Only keep pixels above threshold, make others fully transparent
              if (brightness < threshold) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); // Fully transparent
              } else {
                gl_FragColor = color;
              }
            }
          `
        };

        const bloomOnlyPass = new ShaderPass(bloomOnlyShader);
        composer.addPass(bloomOnlyPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        // Render WITH composer
        const animate = () => {
          requestAnimationFrame(animate);
          composer.render();
        };
        animate();

        console.log('🔍 Bloom active - capturing editor only, no feedback loop');

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
        zIndex: 1,
        mixBlendMode: 'screen',
        border: 'none'
      }}
    >
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
    </div>
  );
}