#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
  outColor = vec4(texture(u_texture, v_texCoord).bgr, 1.0);
}