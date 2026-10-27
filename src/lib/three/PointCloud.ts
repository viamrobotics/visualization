import {
	type BufferAttribute,
	type BufferGeometry,
	type Intersection,
	type InterleavedBufferAttribute,
	type Raycaster,
	Sprite,
	Vector2,
} from 'three'
import {
	instancedBufferAttribute,
	min,
	positionView,
	screenDPR,
	select,
	uniform,
	vec4,
} from 'three/tsl'
import { PointsNodeMaterial } from 'three/webgpu'

import { pickNearestToRay } from './pointsBvh'

type CloudAttribute = BufferAttribute | InterleavedBufferAttribute

const canvasSize = new Vector2()

/** Half the canvas height in CSS pixels, the `scale` three's own point attenuation uses. */
const halfCanvasHeight = uniform(1).onFrameUpdate(function ({ renderer }) {
	if (renderer) {
		this.value = 0.5 * renderer.getSize(canvasSize).y
	}
})

/**
 * A point cloud drawn as one instanced quad per point, so points can be wider than a pixel on
 * WebGPU, where `point-list` always rasterizes 1px.
 *
 * `geometry` is the sprite's quad, so the points live in `cloud`. Picking runs against the
 * `PointsBVH` on `cloud`, once one has been built.
 */
export class PointCloud extends Sprite {
	readonly isPointCloud = true

	readonly cloud: BufferGeometry

	declare material: PointsNodeMaterial

	/** Same units as `PointsMaterial.size`. */
	readonly size = uniform(1)

	/** CSS pixels. `screenDPR` is applied after the clamp. */
	readonly maxSize = uniform(Infinity)

	/** 1 under a perspective camera, 0 under orthographic. */
	readonly isPerspective = uniform(1)

	private boundPosition: CloudAttribute | undefined
	private boundColor: CloudAttribute | undefined

	constructor(cloud: BufferGeometry) {
		super(new PointsNodeMaterial({ sizeAttenuation: false }))

		this.cloud = cloud
		this.frustumCulled = false

		// Orthographic sizes stay in framebuffer pixels, as `PointsMaterial` drew them, so the
		// orthographic branch divides out the `screenDPR` three multiplies in afterwards.
		const attenuated = select(
			this.isPerspective.equal(1),
			this.size.mul(halfCanvasHeight).div(positionView.z.negate()),
			this.size.div(screenDPR)
		)
		this.material.sizeNode = min(attenuated, this.maxSize)

		this.bindAttributes()
	}

	override onBeforeRender(): void {
		this.bindAttributes()

		const { drawRange } = this.cloud
		const available = (this.boundPosition?.count ?? 0) - drawRange.start
		this.count = Math.max(0, Math.min(drawRange.count, available))
	}

	override raycast(raycaster: Raycaster, intersects: Intersection[]): void {
		const tree = this.cloud.boundsTree

		if (!tree) {
			return
		}

		const { firstHitOnly } = raycaster
		const candidates: Intersection[] = []

		raycaster.firstHitOnly = false
		tree.raycastObject3D(this, raycaster, candidates)
		raycaster.firstHitOnly = firstHitOnly

		const nearest = pickNearestToRay(candidates)

		if (nearest) {
			intersects.push(nearest)
		}
	}

	dispose(): void {
		this.material.dispose()
	}

	private bindAttributes(): void {
		const position = this.cloud.getAttribute('position') as CloudAttribute | undefined
		const color = this.cloud.getAttribute('color') as CloudAttribute | undefined

		if (position === this.boundPosition && color === this.boundColor) {
			return
		}

		this.boundPosition = position
		this.boundColor = color

		this.material.positionNode = position ? instancedBufferAttribute(position) : null
		this.material.colorNode = color ? vec4(instancedBufferAttribute(color)) : null
		this.material.needsUpdate = true
	}
}
