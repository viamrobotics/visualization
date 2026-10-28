import {
	Box3,
	BufferGeometry,
	Color,
	type ColorRepresentation,
	DynamicDrawUsage,
	FrontSide,
	Group,
	InstancedBufferAttribute,
	InstancedInterleavedBuffer,
	InterleavedBufferAttribute,
	Material,
	Mesh,
	Vector3,
} from 'three'
import {
	abs,
	attribute,
	cross,
	Fn,
	length,
	max as maxNode,
	min as minNode,
	normalize,
	positionGeometry,
	select,
	sRGBTransferEOTF,
	uniform,
	vec3,
} from 'three/tsl'
import { MeshBasicNodeMaterial, type Node, type UniformNode } from 'three/webgpu'

import { STRIDE } from '$lib/buffer'

import { computeBoundingBox } from './box'
import { createHeadGeometry, createShaftGeometry, toInstanced } from './geometry'

const defaults = {
	LENGTH: 0.1,
	HEAD_LENGTH: 0.02,
	HEAD_WIDTH: 0.005,
	SHAFT_RADIUS: 0.001,
}

const MINIMUM_ARROW_LENGTH = 1e-6
const COLORS_RGBA = 4
const OPAQUE = 255
const MILLIMETERS_TO_METERS = 0.001

/** Past this, the direction is too close to +Z for Z to serve as the basis helper axis. */
const NEARLY_PARALLEL_TO_Z = 0.999

const origin = new Vector3()
const direction = new Vector3()
const min = new Vector3()
const max = new Vector3()

const createUniforms = (options: {
	arrowLength: number
	shaftRadius: number
	headLength: number
	headWidth: number
}) => ({
	/** 1 puts the head tip at the pose origin, 0 puts the base there. */
	headAtOrigin: uniform(1),
	arrowLength: uniform(options.arrowLength),
	shaftRadius: uniform(options.shaftRadius),
	headLength: uniform(options.headLength),
	headWidth: uniform(options.headWidth),
})

type ArrowUniforms = ReturnType<typeof createUniforms>

/**
 * Places a unit shaft or cone vertex along its instance's pose. `instanceOrigin` is in
 * millimetres, and `instanceDirection` only orients: every arrow is `arrowLength` long.
 */
const arrowPosition = (uniforms: ArrowUniforms, isHead: boolean) =>
	Fn(() => {
		const arrowLength = maxNode(uniforms.arrowLength, MINIMUM_ARROW_LENGTH)

		const instanceDirection = attribute<'vec3'>('instanceDirection', 'vec3')
		const magnitude = length(instanceDirection)
		const basisY = select(magnitude.greaterThan(0), instanceDirection.div(magnitude), vec3(0, 1, 0))
		const helperAxis = select(
			abs(basisY.z).lessThan(NEARLY_PARALLEL_TO_Z),
			vec3(0, 0, 1),
			vec3(1, 0, 0)
		)
		const basisX = normalize(cross(helperAxis, basisY))
		const basisZ = cross(basisY, basisX)

		const poseOrigin = attribute<'vec3'>('instanceOrigin', 'vec3').mul(MILLIMETERS_TO_METERS)
		const effectiveOrigin = select(
			uniforms.headAtOrigin.greaterThan(0.5),
			poseOrigin.sub(basisY.mul(arrowLength)),
			poseOrigin
		)

		const headLength = minNode(uniforms.headLength, arrowLength)
		const shaftLength = maxNode(arrowLength.sub(headLength), 0)

		const scaled = isHead
			? vec3(
					positionGeometry.x.mul(uniforms.headWidth),
					positionGeometry.y.mul(headLength),
					positionGeometry.z.mul(uniforms.headWidth)
				)
			: select(
					shaftLength.greaterThan(0),
					vec3(
						positionGeometry.x.mul(uniforms.shaftRadius),
						positionGeometry.y.mul(shaftLength),
						positionGeometry.z.mul(uniforms.shaftRadius)
					),
					vec3(0, 0, 0)
				)

		const start = isHead ? effectiveOrigin.add(basisY.mul(shaftLength)) : effectiveOrigin

		return start.add(basisX.mul(scaled.x)).add(basisY.mul(scaled.y)).add(basisZ.mul(scaled.z))
	})()

/**
 * Per-arrow colors arrive as sRGB bytes, so they are decoded to linear for the output pass to
 * encode again. A uniform color is already linear, since `Color.set` converts it.
 */
const createMaterial = (options: {
	isHead: boolean
	uniforms: ArrowUniforms
	uniformColor: UniformNode<'color', Color> | undefined
}) => {
	const material = new MeshBasicNodeMaterial({ side: FrontSide, depthTest: true, depthWrite: true })
	material.toneMapped = false
	material.positionNode = arrowPosition(options.uniforms, options.isHead)
	material.colorNode =
		options.uniformColor ??
		(sRGBTransferEOTF(attribute<'vec4'>('instanceColor', 'vec4').rgb) as Node<'vec3'>)
	return material
}

export class InstancedArrows extends Group {
	isInstancedArrows = true

	count: number
	arrowLength: number
	shaftRadius: number
	headLength: number
	headWidth: number

	shaftMesh: Mesh
	headMesh: Mesh

	attributes: BufferGeometry['attributes']

	poses: InstancedInterleavedBuffer

	constructor(
		options: {
			count?: number
			length?: number
			shaftRadius?: number
			headLength?: number
			headWidth?: number
			alpha?: boolean
			uniformColor?: ColorRepresentation
		} = {}
	) {
		super()

		this.count = options?.count ?? 0
		this.shaftRadius = options?.shaftRadius ?? defaults.SHAFT_RADIUS
		this.headLength = options?.headLength ?? defaults.HEAD_LENGTH
		this.headWidth = options?.headWidth ?? defaults.HEAD_WIDTH
		this.arrowLength = options?.length ?? defaults.LENGTH

		const stride = 6
		const posesInterleaved = new Float32Array(this.count * stride)
		this.poses = new InstancedInterleavedBuffer(posesInterleaved, stride)
		this.poses.setUsage(DynamicDrawUsage)

		const instanceOrigin = new InterleavedBufferAttribute(this.poses, 3, 0, false)
		const instanceDirection = new InterleavedBufferAttribute(this.poses, 3, 3, false)

		this.attributes = {
			instanceOrigin,
			instanceDirection,
		}

		if (!options.uniformColor) {
			// RGBA, not RGB: three's WebGPU backend re-pads a 3-byte attribute element by element
			// on every upload, which at a million arrows costs seconds.
			const colors = new Uint8Array(this.count * COLORS_RGBA)
			for (let alpha = COLORS_RGBA - 1; alpha < colors.length; alpha += COLORS_RGBA) {
				colors[alpha] = OPAQUE
			}
			const instanceColor = new InstancedBufferAttribute(colors, COLORS_RGBA, true)
			instanceColor.setUsage(DynamicDrawUsage)

			this.attributes.instanceColor = instanceColor
		}

		const shaftGeometry = toInstanced(createShaftGeometry(), this.count, this.attributes)
		shaftGeometry.computeBoundingBox = computeBoundingBox.bind(this, shaftGeometry)

		const headGeometry = toInstanced(createHeadGeometry(), this.count, this.attributes)
		headGeometry.computeBoundingBox = computeBoundingBox.bind(this, headGeometry)

		const uniforms = createUniforms(this)
		const uniformColor = options.uniformColor ? uniform(new Color(options.uniformColor)) : undefined

		const shaftMaterial = createMaterial({ isHead: false, uniforms, uniformColor })
		const headMaterial = createMaterial({ isHead: true, uniforms, uniformColor })

		this.shaftMesh = new Mesh(shaftGeometry, shaftMaterial)
		this.headMesh = new Mesh(headGeometry, headMaterial)

		this.shaftMesh.frustumCulled = false
		this.headMesh.frustumCulled = false

		this.shaftMesh.raycast = () => null
		this.headMesh.raycast = () => null

		this.add(this.shaftMesh, this.headMesh)
	}

	/**
	 * Copies as much of each buffer as this instance has room for, dropping the
	 * rest. The colors buffer is sized independently of the poses, so a caller
	 * that sends more colors than arrows is writing past the end of the
	 * attribute. `TypedArray.set` throws on that rather than truncating, and the
	 * throw would surface inside the koota `onAdd` that `entity.add` runs
	 * synchronously, taking the whole draw-service flush down with it and
	 * stranding the entity the flush was spawning.
	 */
	update(arrows: { poses?: Float32Array; colors?: Uint8Array; headAtPose?: boolean }) {
		if (arrows.poses) {
			const poses = this.poses.array
			poses.set(arrows.poses.subarray(0, poses.length))
			this.poses.needsUpdate = true
		}

		if (arrows.colors && this.attributes.instanceColor) {
			const colors = this.attributes.instanceColor.array
			const source = arrows.colors
			const count = Math.min(
				Math.floor(source.length / STRIDE.COLORS_RGB),
				colors.length / COLORS_RGBA
			)

			for (let index = 0; index < count; index += 1) {
				const from = index * STRIDE.COLORS_RGB
				const to = index * COLORS_RGBA
				colors[to] = source[from]
				colors[to + 1] = source[from + 1]
				colors[to + 2] = source[from + 2]
			}

			this.attributes.instanceColor.needsUpdate = true
		}
	}

	getBoundingBoxAt(instanceId: number, target: Box3): Box3 {
		this.getPoseAt(instanceId, origin, direction)

		const r = Math.max(this.shaftRadius, this.headWidth)

		const directionLength = direction.length()
		if (directionLength > 0) direction.multiplyScalar(1 / directionLength)
		else direction.set(0, 1, 0)

		direction.multiplyScalar(this.arrowLength).add(origin)

		min.set(
			Math.min(origin.x, direction.x) - r,
			Math.min(origin.y, direction.y) - r,
			Math.min(origin.z, direction.z) - r
		)
		max.set(
			Math.max(origin.x, direction.x) + r,
			Math.max(origin.y, direction.y) + r,
			Math.max(origin.z, direction.z) + r
		)

		target.min.copy(min)
		target.max.copy(max)
		return target
	}

	getPoseAt(instanceID: number, origin: Vector3, direction: Vector3): void {
		const i = instanceID * 6
		const { array } = this.poses
		origin.set(array[i], array[i + 1], array[i + 2])
		direction.set(array[i + 3], array[i + 4], array[i + 5])
	}

	dispose() {
		this.shaftMesh.geometry.dispose()
		this.headMesh.geometry.dispose()
		;(this.shaftMesh.material as Material).dispose()
		;(this.headMesh.material as Material).dispose()
	}
}
