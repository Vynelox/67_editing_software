#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;
uniform vec2 u_resolution;

// Hardcoded values - no uniforms needed!
const float THRESHOLD = 0.4;  // Only pixels brighter than 70% will glow
const float GLOW_STRENGTH = 0.5;  // Glow intensity
const float GLOW_SPREAD = 2.0;  // How far the glow spreads

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  
  // Sample the center pixel
  vec4 centerColor = texture(u_texture, v_texCoord);
  vec4 fixedCenter = vec4(centerColor.bgr, centerColor.a);
  
  // Calculate center brightness
  float centerBrightness = dot(fixedCenter.rgb, vec3(0.2126, 0.7152, 0.0722));
  
  // Glow accumulation
  vec4 glow = vec4(0.0);
  int glowCount = 0;
  
  // Sample in a 3x3 grid around the pixel
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      if (x == 0 && y == 0) continue; // Skip center (we already have it)
      
      vec2 offset = vec2(float(x), float(y)) * texelSize * GLOW_SPREAD;
      vec4 sampleColor = texture(u_texture, v_texCoord + offset);
      vec4 fixedSample = vec4(sampleColor.bgr, sampleColor.a);
      
      // Check if this neighbor is bright
      float sampleBrightness = dot(fixedSample.rgb, vec3(0.2126, 0.7152, 0.0722));
      
      if (sampleBrightness > THRESHOLD) {
        glow += fixedSample;
        glowCount++;
      }
    }
  }
  
  // Average the glow
  if (glowCount > 0) {
    glow /= float(glowCount);
  }
  
  // Combine: if center is bright, use original + glow. Otherwise, just original
  outColor = fixedCenter + glow * GLOW_STRENGTH;
  
}