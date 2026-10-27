import {
	BufferAttribute,
	type BufferGeometry,
	DynamicDrawUsage,
	InstancedBufferAttribute,
	InstancedBufferGeometry,
	type Intersection,
	type Raycaster,
	Sprite,
	Vector2,
} from 'three'
import { attribute, min, positionView, screenDPR, select, uniform, vec4 } from 'three/tsl'
import { PointsNodeMaterial } from 'three/webgpu'

import { pickNearestToRay } from './pointsBvh'

const RGBA_ITEM_SIZE = 4
const INSTANCE_POSITION = 'instancePosition'
const INSTANCE_COLOR = 'instanceColor'

interface InstancedCopy {
	source: BufferAttribute
	instanced: InstancedBufferAttribute
	version: number
}

const canvasSize = new Vector2()

/** Half the canvas height in CSS pixels, the `scale` three's own point attenuation uses. */
const halfCanvasHeight = uniform(1).onFrameUpdate(function ({ renderer }) {
	if (renderer) {
		this.value = 0.5 * renderer.getSize(canvasSize).y
	}
})

/** The same unit quad `Sprite` draws, owned per cloud so disposing one never frees another's. */
const createQuadGeometry = (): InstancedBufferGeometry => {
	const geometry = new InstancedBufferGeometry()
	geometry.setIndex([0, 1, 2, 0, 2, 3])
	geometry.setAttribute(
		'position',
		new BufferAttribute(
			new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
			3
		)
	)
	geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
	geometry.instanceCount = 0
	return geometry
}

/**
 * Mirrors a cloud attribute as a per-instance attribute over the same array. Nothing renders
 * the cloud geometry itself, so the copy is the only GPU buffer the points occupy.
 */
const createInstancedCopy = (source: BufferAttribute): InstancedCopy => {
	const instanced = new InstancedBufferAttribute(source.array, source.itemSize, source.normalized)
	instanced.setUsage(DynamicDrawUsage)
	return { source, instanced, version: source.version }
}

/** Forwards writes made to the cloud attribute, as partial uploads where it recorded ranges. */
const syncInstancedCopy = (copy: InstancedCopy): void => {
	const { source, instanced } = copy

	if (source.version === copy.version) {
		return
	}

	for (const { start, count } of source.updateRanges) {
		instanced.addUpdateRange(start, count)
	}

	source.clearUpdateRanges()
	instanced.needsUpdate = true
	copy.version = source.version
}

/**
 * A point cloud drawn as one instanced quad per point, so points can be wider than a pixel on
 * WebGPU, where `point-list` always rasterizes 1px.
 *
 * `geometry` is the instanced quad, so the points live in `cloud`. Picking runs against the
 * `PointsBVH` on `cloud`, once one has been built.
 */
export class PointCloud extends Sprite {
	readonly isPointCloud = true

	declare geometry: InstancedBufferGeometry

	declare material: PointsNodeMaterial

	/** Same units as `PointsMaterial.size`. */
	readonly size = uniform(1)

	/** CSS pixels. `screenDPR` is applied after the clamp. */
	readonly maxSize = uniform(Infinity)

	/** 1 under a perspective camera, 0 under orthographic. */
	readonly isPerspective = uniform(1)

	private currentCloud: BufferGeometry
	private positionCopy: InstancedCopy | undefined
	private colorCopy: InstancedCopy | undefined
	private colorItemSize: number | undefined

	constructor(cloud: BufferGeometry) {
		super(new PointsNodeMaterial({ sizeAttenuation: false }))

		this.currentCloud = cloud
		this.geometry = createQuadGeometry()
		this.frustumCulled = false

		// `SpriteNodeMaterial` defaults to transparent. Blending loses the GPU's hidden-surface
		// removal and moves the cloud into the sorted transparent pass, where meshes misorder it.
		this.material.transparent = false

		// Orthographic sizes stay in framebuffer pixels, as `PointsMaterial` drew them, so the
		// orthographic branch divides out the `screenDPR` three multiplies in afterwards.
		const attenuated = select(
			this.isPerspective.equal(1),
			this.size.mul(halfCanvasHeight).div(positionView.z.negate()),
			this.size.div(screenDPR)
		)
		this.material.sizeNode = min(attenuated, this.maxSize)
		this.material.positionNode = attribute<'vec3'>(INSTANCE_POSITION, 'vec3')

		this.update()
	}

	get cloud(): BufferGeometry {
		return this.currentCloud
	}

	/**
	 * Swaps in a replacement cloud while keeping the material, so its shader is not rebuilt.
	 * The quad geometry is replaced too, since disposing it is what frees the old copies' GPU
	 * buffers. The caller still owns and disposes the previous cloud.
	 */
	set cloud(cloud: BufferGeometry) {
		if (cloud === this.currentCloud) {
			return
		}

		this.geometry.dispose()
		this.geometry = createQuadGeometry()
		this.positionCopy = undefined
		this.colorCopy = undefined
		this.currentCloud = cloud
		this.update()
	}

	/**
	 * Brings the instanced copies in line with `cloud`: rebinds a replaced attribute, forwards
	 * pending writes, and draws only the cloud's draw range. Runs before every render.
	 */
	update(): void {
		this.bindPosition()
		this.bindColor()

		if (this.positionCopy) syncInstancedCopy(this.positionCopy)
		if (this.colorCopy) syncInstancedCopy(this.colorCopy)

		const available = this.positionCopy?.source.count ?? 0
		this.geometry.instanceCount = Math.max(0, Math.min(this.cloud.drawRange.count, available))
	}

	override onBeforeRender(): void {
		this.update()
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
		this.geometry.dispose()
		this.material.dispose()
	}

	private bindPosition(): void {
		const source = this.cloud.getAttribute('position') as BufferAttribute | undefined

		if (
			source === this.positionCopy?.source &&
			source?.array === this.positionCopy?.instanced.array
		) {
			return
		}

		this.positionCopy = source ? createInstancedCopy(source) : undefined

		if (this.positionCopy) {
			this.geometry.setAttribute(INSTANCE_POSITION, this.positionCopy.instanced)
		} else {
			this.geometry.deleteAttribute(INSTANCE_POSITION)
		}
	}

	private bindColor(): void {
		const source = this.cloud.getAttribute('color') as BufferAttribute | undefined

		if (source === this.colorCopy?.source && source?.array === this.colorCopy?.instanced.array) {
			return
		}

		this.colorCopy = source ? createInstancedCopy(source) : undefined

		if (this.colorCopy) {
			this.geometry.setAttribute(INSTANCE_COLOR, this.colorCopy.instanced)
		} else {
			this.geometry.deleteAttribute(INSTANCE_COLOR)
		}

		// Tracked apart from `colorCopy`, which a cloud swap clears without changing the node.
		if (source?.itemSize !== this.colorItemSize) {
			this.colorItemSize = source?.itemSize
			this.material.colorNode = this.colorNodeFor(source)
			this.material.needsUpdate = true
		}
	}

	private colorNodeFor(source: BufferAttribute | undefined) {
		if (!source) {
			return null
		}

		return source.itemSize === RGBA_ITEM_SIZE
			? attribute<'vec4'>(INSTANCE_COLOR, 'vec4')
			: vec4(attribute<'vec3'>(INSTANCE_COLOR, 'vec3'), 1)
	}
}
