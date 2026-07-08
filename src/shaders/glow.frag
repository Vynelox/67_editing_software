#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;
uniform vec2 u_resolution;

// Bloom parameters
const float THRESHOLD = 0.5;      // Brightness threshold for bloom
const float STRENGTH = 1.5;       // Bloom intensity
const float BLUR_RADIUS = 2.0;    // Blur spread

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  
  // Sample the original pixel
  vec4 original = texture(u_texture, v_texCoord);
  
  // --- Bright pass: extract bright pixels ---
  float brightness = dot(original.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec4 bright = brightness > THRESHOLD ? original : vec4(0.0);
  
  // --- Gaussian blur (9-tap) on the bright pass ---
  // We blur by sampling in a cross pattern (horizontal + vertical)
  // This approximates a 2D gaussian blur in a single pass
  vec4 blur = vec4(0.0);
  float totalWeight = 0.0;
  
  // Gaussian weights for 9 taps (radius 4)
  float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  
  // Center sample
  blur += bright * weights[0];
  totalWeight += weights[0];
  
  // Sample in all 4 directions (diagonals for better 2D approximation)
  for (int i = 1; i < 5; i++) {
    float w = weights[i];
    float offset = float(i) * BLUR_RADIUS * texelSize.x;
    
    // Right + Up
    blur += texture(u_texture, v_texCoord + vec2( offset,  offset)) * w;
    // Right + Down
    blur += texture(u_texture, v_texCoord + vec2( offset, -offset)) * w;
    // Left + Up
    blur += texture(u_texture, v_texCoord + vec2(-offset,  offset)) * w;
    // Left + Down
    blur += texture(u_texture, v_texCoord + vec2(-offset, -offset)) * w;
    
    totalWeight += w * 4.0;
  }
  
  blur /= totalWeight;
  
  // --- Composite: original + blurred bright pixels ---
  vec3 finalColor = original.rgb + blur.rgb * STRENGTH;
  
  outColor = vec4(finalColor, original.a);
}