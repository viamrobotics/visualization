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

const RGB_ITEM_SIZE = 3
const RGBA_ITEM_SIZE = 4
const OPAQUE_BYTE = 255
const INSTANCE_POSITION = 'instancePosition'
const INSTANCE_COLOR = 'instanceColor'

interface InstancedCopy {
	source: BufferAttribute
	/** The array `source` held when the copy was made, to detect it being reallocated. */
	sourceArray: BufferAttribute['array']
	instanced: InstancedBufferAttribute
	/** Whether `instanced` holds RGBA padded from 3-byte RGB rather than sharing `sourceArray`. */
	isPadded: boolean
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
 * WebGPU vertex strides are multiples of 4 bytes, so three pads 3-byte colors on every upload,
 * with a `subarray` per point. That costs seconds per refresh of a 1M-point cloud, so
 * `PointCloud` pads them itself.
 */
const isThreeByteColor = (
	source: BufferAttribute
): source is BufferAttribute & { array: Uint8Array } =>
	source.itemSize === RGB_ITEM_SIZE && source.array instanceof Uint8Array

/** Copies RGB into the first three bytes of each RGBA texel in `[startPoint, endPoint)`. */
const copyRgbIntoRgba = (
	rgb: Uint8Array,
	rgba: Uint8Array,
	startPoint: number,
	endPoint: number
): void => {
	for (let point = startPoint; point < endPoint; point++) {
		const from = point * RGB_ITEM_SIZE
		const to = point * RGBA_ITEM_SIZE
		rgba[to] = rgb[from]
		rgba[to + 1] = rgb[from + 1]
		rgba[to + 2] = rgb[from + 2]
	}
}

/**
 * Mirrors a cloud attribute as a per-instance attribute. Nothing renders the cloud geometry
 * itself, so the copy is the only GPU buffer the points occupy. It shares the source array,
 * except for 3-byte colors, which it pads to opaque RGBA.
 */
const createInstancedCopy = (source: BufferAttribute): InstancedCopy => {
	const isPadded = isThreeByteColor(source)
	let instanced: InstancedBufferAttribute

	if (isPadded) {
		const rgba = new Uint8Array(source.count * RGBA_ITEM_SIZE).fill(OPAQUE_BYTE)
		copyRgbIntoRgba(source.array, rgba, 0, source.count)
		instanced = new InstancedBufferAttribute(rgba, RGBA_ITEM_SIZE, true)
	} else {
		instanced = new InstancedBufferAttribute(source.array, source.itemSize, source.normalized)
	}

	instanced.setUsage(DynamicDrawUsage)
	return { source, sourceArray: source.array, instanced, isPadded, version: source.version }
}

/** Whether `copy` no longer mirrors `source`, because either was added, removed, or reallocated. */
const isCopyStale = (copy: InstancedCopy | undefined, source: BufferAttribute | undefined) =>
	copy?.source !== source || copy?.sourceArray !== source?.array

/** Forwards a padded copy's pending writes, converting its ranges from RGB to RGBA. */
const syncPaddedCopy = (copy: InstancedCopy): void => {
	const rgb = copy.source.array as Uint8Array
	const rgba = copy.instanced.array as Uint8Array

	if (copy.source.updateRanges.length === 0) {
		copyRgbIntoRgba(rgb, rgba, 0, copy.source.count)
		return
	}

	for (const { start, count } of copy.source.updateRanges) {
		const startPoint = Math.floor(start / RGB_ITEM_SIZE)
		const endPoint = Math.ceil((start + count) / RGB_ITEM_SIZE)
		copyRgbIntoRgba(rgb, rgba, startPoint, endPoint)
		copy.instanced.addUpdateRange(
			startPoint * RGBA_ITEM_SIZE,
			(endPoint - startPoint) * RGBA_ITEM_SIZE
		)
	}
}

/** Forwards writes made to the cloud attribute, as partial uploads where it recorded ranges. */
const syncInstancedCopy = (copy: InstancedCopy): void => {
	const { source, instanced } = copy

	if (source.version === copy.version) {
		return
	}

	if (copy.isPadded) {
		syncPaddedCopy(copy)
	} else {
		for (const { start, count } of source.updateRanges) {
			instanced.addUpdateRange(start, count)
		}
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
	 * The caller still owns and disposes the previous cloud.
	 */
	set cloud(cloud: BufferGeometry) {
		this.currentCloud = cloud
		this.update()
	}

	/**
	 * Brings the instanced copies in line with `cloud`: rebinds a replaced attribute, forwards
	 * pending writes, and draws only the cloud's draw range. Runs before every render.
	 */
	update(): void {
		const position = this.cloud.getAttribute('position') as BufferAttribute | undefined
		const color = this.cloud.getAttribute('color') as BufferAttribute | undefined

		if (isCopyStale(this.positionCopy, position) || isCopyStale(this.colorCopy, color)) {
			this.rebuildCopies(position, color)
		}

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

	/**
	 * Recreates both copies on a fresh quad geometry. Three frees an attribute's GPU buffer only
	 * when its geometry is disposed, so replacing a copy in place would leak the old one.
	 */
	private rebuildCopies(
		position: BufferAttribute | undefined,
		color: BufferAttribute | undefined
	): void {
		this.geometry.dispose()
		this.geometry = createQuadGeometry()

		this.positionCopy = position ? createInstancedCopy(position) : undefined
		this.colorCopy = color ? createInstancedCopy(color) : undefined

		if (this.positionCopy) {
			this.geometry.setAttribute(INSTANCE_POSITION, this.positionCopy.instanced)
		}

		if (this.colorCopy) {
			this.geometry.setAttribute(INSTANCE_COLOR, this.colorCopy.instanced)
		}

		// Padded RGB and RGBA both read as `vec4`, so swapping between them keeps the shader.
		const colorItemSize = this.colorCopy?.instanced.itemSize
		if (colorItemSize !== this.colorItemSize) {
			this.colorItemSize = colorItemSize
			this.material.colorNode = this.colorNodeFor(colorItemSize)
			this.material.needsUpdate = true
		}
	}

	private colorNodeFor(itemSize: number | undefined) {
		if (itemSize === undefined) {
			return null
		}

		return itemSize === RGBA_ITEM_SIZE
			? attribute<'vec4'>(INSTANCE_COLOR, 'vec4')
			: vec4(attribute<'vec3'>(INSTANCE_COLOR, 'vec3'), 1)
	}
}
