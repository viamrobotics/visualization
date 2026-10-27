import { BufferAttribute, BufferGeometry, PerspectiveCamera, RenderTarget, Scene } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PointCloud } from '../PointCloud'

const SIZE = 64
const RGBA = 4
const LIT_THRESHOLD = 127

const cloudOf = (positions: number[], colors?: { array: Uint8Array; itemSize: number }) => {
	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
	if (colors) {
		geometry.setAttribute('color', new BufferAttribute(colors.array, colors.itemSize, true))
	}
	return geometry
}

describe('PointCloud', () => {
	let renderer: WebGPURenderer
	let target: RenderTarget

	const render = async (pointCloud: PointCloud) => {
		const scene = new Scene()
		const camera = new PerspectiveCamera(90, 1, 0.1, 10)
		camera.position.z = 1
		scene.add(pointCloud)

		renderer.setRenderTarget(target)
		renderer.render(scene, camera)

		return renderer.readRenderTargetPixelsAsync(target, 0, 0, SIZE, SIZE)
	}

	const countLit = (pixels: ArrayLike<number>) => {
		let lit = 0
		for (let index = 0; index < pixels.length; index += RGBA) {
			if (pixels[index] > LIT_THRESHOLD) lit += 1
		}
		return lit
	}

	beforeEach(async () => {
		renderer = new WebGPURenderer()
		renderer.setPixelRatio(1)
		renderer.setSize(SIZE, SIZE, false)
		await renderer.init()
		target = new RenderTarget(SIZE, SIZE)
	})

	afterEach(() => {
		target.dispose()
		renderer.dispose()
	})

	it('caps an attenuated point at maxSize', async () => {
		const pointCloud = new PointCloud(cloudOf([0, 0, 0]))
		pointCloud.material.toneMapped = false
		pointCloud.size.value = 1
		pointCloud.maxSize.value = 4

		const pixels = await render(pointCloud)

		expect(countLit(pixels), 'a 4px square, not the 32px the attenuation asks for').toBe(16)
	})

	it('reads normalized Uint8 colors as 0 to 1', async () => {
		const colors = { array: new Uint8Array([128, 0, 0]), itemSize: 3 }
		const pointCloud = new PointCloud(cloudOf([0, 0, 0], colors))
		pointCloud.material.toneMapped = false
		pointCloud.size.value = 1
		pointCloud.maxSize.value = 4

		const pixels = await render(pointCloud)
		const center = ((SIZE / 2) * SIZE + SIZE / 2) * RGBA

		expect(pixels[center]).toBeGreaterThanOrEqual(126)
		expect(pixels[center]).toBeLessThanOrEqual(130)
	})

	it("draws only the cloud's draw range", () => {
		const cloud = cloudOf([0, 0, 0, 1, 0, 0, 2, 0, 0])
		cloud.setDrawRange(0, 1)
		const pointCloud = new PointCloud(cloud)

		pointCloud.update()

		expect(pointCloud.geometry.instanceCount).toBe(1)
	})

	it('forwards a chunk written to the cloud after creation', () => {
		const cloud = cloudOf([0, 0, 0, 0, 0, 0])
		const pointCloud = new PointCloud(cloud)
		const source = cloud.getAttribute('position') as BufferAttribute

		source.setXYZ(1, 1, 2, 3)
		source.addUpdateRange(3, 3)
		source.needsUpdate = true
		pointCloud.update()

		const instanced = pointCloud.geometry.getAttribute('instancePosition') as BufferAttribute
		expect(instanced.updateRanges).toEqual([{ start: 3, count: 3 }])
		expect(instanced.array.slice(3, 6)).toEqual(new Float32Array([1, 2, 3]))
	})

	it('rebinds when the cloud swaps in a new position attribute', () => {
		const cloud = cloudOf([0, 0, 0])
		const pointCloud = new PointCloud(cloud)

		cloud.setAttribute('position', new BufferAttribute(new Float32Array([4, 5, 6, 7, 8, 9]), 3))
		pointCloud.update()

		const instanced = pointCloud.geometry.getAttribute('instancePosition') as BufferAttribute
		expect(instanced.array).toEqual(new Float32Array([4, 5, 6, 7, 8, 9]))
		expect(pointCloud.geometry.instanceCount).toBe(2)
	})
})
