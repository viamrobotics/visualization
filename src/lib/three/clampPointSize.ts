import type { PointsMaterial } from 'three'

const UNIFORM = 'uniform float maxPointSize;'
const CLAMP = 'gl_PointSize = min( gl_PointSize, maxPointSize );'

/**
 * Applies the ceiling after three.js has finished sizing the point, so it caps the result of
 * size attenuation rather than the pre-attenuation size.
 */
export const patchPointSizeClamp = (vertexShader: string): string =>
	vertexShader
		.replace('void main() {', `${UNIFORM}\nvoid main() {`)
		.replace('#include <logdepthbuf_vertex>', `${CLAMP}\n\t#include <logdepthbuf_vertex>`)

/**
 * A point's screen size grows without limit as the camera nears it — metres away it covers a few
 * pixels, centimetres away it covers thousands. `PointsMaterial` has no ceiling for that, so
 * patch one in. `maxPointSize.value` is in framebuffer pixels.
 */
export const clampPointSize = (material: PointsMaterial, maxPointSize: { value: number }) => {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.maxPointSize = maxPointSize
		shader.vertexShader = patchPointSizeClamp(shader.vertexShader)
	}
}
