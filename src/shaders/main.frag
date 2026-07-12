#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;
uniform vec2 u_resolution;

// The radius of the glow. 15 means it looks 15 pixels in every direction.
// Don't go above 30 or your framerate will drop!
#define RADIUS 15.0
#define B_THRESHOLD 0.2
#define GLOW_POWER 10.0
#define mathematicalBrightness true
float sigma = RADIUS / 3.0;  // Add this!

float calculateBrightness(vec3 inputvec, bool mathematical){
  if(mathematical){
    return dot(inputvec, vec3(1.0/3.0, 1.0/3.0, 1.0/3.0));
  }
  else{
    return dot(inputvec, vec3(0.2126, 0.7152, 0.0722));
  }
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  
  // 1. Get the center pixel
  vec4 centerColor = texture(u_texture, v_texCoord);
  vec4 fixedCenter = vec4(centerColor.bgr, centerColor.a);
  
  // Calculate center brightness
  float centerBrightness = calculateBrightness(fixedCenter.rgb, mathematicalBrightness);
  
  vec4 glow = vec4(0.0);

  // 2. Loop through the neighbors
  for (float x = -RADIUS; x <= RADIUS; x++) {
    for (float y = -RADIUS; y <= RADIUS; y++) {
      
      // Skip the center pixel itself
      if (x == 0.0 && y == 0.0) continue;
      
      // Calculate distance for the weight (1/d)
      float distance = sqrt(x * x + y * y);
      float weight = exp(-(distance * distance) / (2.0 * sigma * sigma));
      
      // Sample the neighbor
      vec2 offset = vec2(x, y) * texelSize;
      vec4 sampleColor = texture(u_texture, v_texCoord + offset);
      vec4 fixedSample = vec4(sampleColor.bgr, sampleColor.a);
      
      // Calculate neighbor brightness
      float sampleBrightness = calculateBrightness(fixedSample.rgb, mathematicalBrightness);
      
      // 3. YOUR RULE: If neighbor is brighter, add it with weight
      if (sampleBrightness > B_THRESHOLD) {
        float brightnessFactor = pow(sampleBrightness, GLOW_POWER);
        glow += fixedSample * weight * brightnessFactor;
      }
    }
  }
  
  // Add the accumulated glow to the center pixel
  // We multiply by a small number so it doesn't blow out to pure white
  
  outColor = fixedCenter + (glow*1.0);
  
  
}