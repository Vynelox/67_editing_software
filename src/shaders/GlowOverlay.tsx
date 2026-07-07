import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export default function GlowOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const animationIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create Three.js renderer with proper alpha settings
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = true;
    rendererRef.current = renderer;

    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Create orthographic camera that fills the screen
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.z = 1;
    cameraRef.current = camera;

    // Create a subtle glowing particle field / light leak effect
    // Using points with additive blending for a nice bloom effect
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    const alphas = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Random positions across the screen
      positions[i * 3] = (Math.random() - 0.5) * 2.2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;

      // Random sizes
      sizes[i] = Math.random() * 0.02 + 0.005;

      // Warm glow colors (orange/amber/pink tones)
      const colorChoice = Math.random();
      if (colorChoice < 0.33) {
        // Warm orange/amber
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.5 + Math.random() * 0.3;
        colors[i * 3 + 2] = 0.1 + Math.random() * 0.2;
      } else if (colorChoice < 0.66) {
        // Soft pink/rose
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.3 + Math.random() * 0.4;
        colors[i * 3 + 2] = 0.5 + Math.random() * 0.3;
      } else {
        // Cyan/blue accent
        colors[i * 3] = 0.2 + Math.random() * 0.3;
        colors[i * 3 + 1] = 0.7 + Math.random() * 0.3;
        colors[i * 3 + 2] = 1.0;
      }

      alphas[i] = Math.random() * 0.5 + 0.1;

      // Slow drift velocities
      velocities[i * 3] = (Math.random() - 0.5) * 0.0001;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.0001;
      velocities[i * 3 + 2] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));

    // Custom shader material for particles with additive blending
    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: window.devicePixelRatio },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 aColor;
        attribute float aAlpha;
        attribute vec3 aVelocity;
        uniform float uTime;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          
          // Animate position with subtle drift
          vec3 pos = position + aVelocity * uTime * 100.0;
          
          // Add subtle breathing animation
          float breathe = sin(uTime * 0.5 + position.x * 10.0 + position.y * 10.0) * 0.01;
          pos.z += breathe;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          // Soft circular gradient
          float dist = length(gl_PointCoord - vec2(0.5));
          float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
          
          // Additive glow color
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    const particles = new THREE.Points(geometry, particleMaterial);
    scene.add(particles);

    // Add a subtle full-screen vignette/glow layer
    const vignetteGeometry = new THREE.PlaneGeometry(2, 2);
    const vignetteMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          
          // Subtle vignette with animated breathing
          float vignette = 1.0 - smoothstep(0.3, 1.0, dist);
          float breathe = sin(uTime * 0.3) * 0.1 + 0.9;
          vignette *= breathe;
          
          // Very subtle warm glow at edges
          vec3 glowColor = vec3(0.15, 0.08, 0.03) * vignette * 0.08;
          
          gl_FragColor = vec4(glowColor, vignette * 0.15);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const vignette = new THREE.Mesh(vignetteGeometry, vignetteMaterial);
    vignette.renderOrder = -1; // Render behind particles
    scene.add(vignette);

    // Create EffectComposer with UnrealBloomPass
    const composer = new EffectComposer(renderer);
    composerRef.current = composer;

    // Render pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // UnrealBloomPass for real bloom effect
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.8,    // strength
      0.4,    // radius
      0.85    // threshold
    );
    composer.addPass(bloomPass);

    // Handle resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      composer.setSize(width, height);
      bloomPass.setSize(width, height);
      
      // Update particle material uniform
      particleMaterial.uniforms.uPixelRatio.value = window.devicePixelRatio;
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    let startTime = performance.now();

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      
      // Update time uniforms
      particleMaterial.uniforms.uTime.value = elapsed;
      vignetteMaterial.uniforms.uTime.value = elapsed;
      
      // Animate particles - subtle rotation
      particles.rotation.z = elapsed * 0.005;
      
      // Render with bloom
      composer.render();
      
      animationIdRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      
      // Dispose Three.js resources
      geometry.dispose();
      particleMaterial.dispose();
      vignetteGeometry.dispose();
      vignetteMaterial.dispose();
      
      composer.dispose();
      renderer.dispose();
      
      composerRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 1,
      pointerEvents: 'none',
      mixBlendMode: 'screen',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
        }}
      />
    </div>
  );
}