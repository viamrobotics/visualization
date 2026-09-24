import {
	BufferAttribute,
	BufferGeometry,
	PerspectiveCamera,
	Points,
	PointsMaterial,
	Scene,
	ShaderLib,
	WebGLRenderer,
} from 'three'
import { describe, expect, it, vi } from 'vitest'

import { clampPointSize, patchPointSizeClamp } from '../clampPointSize'

describe('patchPointSizeClamp', () => {
	const patched = patchPointSizeClamp(ShaderLib.points.vertexShader)

	it('declares the uniform it reads', () => {
		expect(patched).toContain('uniform float maxPointSize;')
	})

	it('declares the uniform before main, where a body reference can resolve it', () => {
		expect(patched.indexOf('uniform float maxPointSize;')).toBeLessThan(
			patched.indexOf('void main() {')
		)
	})

	it('clamps the attenuated size rather than the size uniform', () => {
		const attenuation = patched.indexOf('gl_PointSize *=')
		const clamp = patched.indexOf('gl_PointSize = min(')

		expect(attenuation).toBeGreaterThan(-1)
		expect(clamp).toBeGreaterThan(attenuation)
	})

	it('clamps before the point size is consumed downstream', () => {
		expect(patched.indexOf('gl_PointSize = min(')).toBeLessThan(
			patched.indexOf('#include <logdepthbuf_vertex>')
		)
	})
})

describe('clampPointSize', () => {
	it('produces a shader the driver accepts', () => {
		const renderer = new WebGLRenderer()
		const scene = new Scene()
		const camera = new PerspectiveCamera()

		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, -1]), 3))

		const material = new PointsMaterial()
		clampPointSize(material, { value: 32 })
		scene.add(new Points(geometry, material))

		const error = vi.spyOn(console, 'error').mockImplementation(() => {})

		try {
			renderer.render(scene, camera)
			expect(error).not.toHaveBeenCalled()
		} finally {
			error.mockRestore()
			renderer.dispose()
		}
	})
})
