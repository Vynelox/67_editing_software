#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;  // Elapsed time in miliseconds since app start

void main(){
  vec2 u_FragCoord = gl_FragCoord.xy / u_resolution.xy;
  vec4 Color = texture(u_texture, v_texCoord).bgra;
  outColor = vec4(Color.rgb * u_FragCoord.x * u_FragCoord.y, Color.a);
  
}