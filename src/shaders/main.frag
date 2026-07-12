#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;

void main() {
  vec4 color = texture(u_texture, v_texCoord); //(b, g, r, a)
  outColor = vec4(color.bgr, 1.0);
}