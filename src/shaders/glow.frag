uniform float u_time;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  
  // Create subtle animated glow waves
  float glow1 = sin(uv.x * 10.0 + u_time * 0.5) * 0.5 + 0.5;
  float glow2 = sin(uv.y * 8.0 + u_time * 0.7) * 0.5 + 0.5;
  float glow3 = sin((uv.x + uv.y) * 6.0 - u_time * 0.3) * 0.5 + 0.5;
  
  // Combine waves for organic feel
  float combinedGlow = (glow1 + glow2 + glow3) / 3.0;
  
  // Soft, subtle glow color - warm tones
  vec3 glowColor = vec3(0.3, 0.2, 0.5) * combinedGlow * 0.15;
  
  // Keep it very subtle
  gl_FragColor = vec4(glowColor, combinedGlow * 0.3);
}