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
	RawShaderMaterial,
	Vector3,
} from 'three'

import { SIZE } from '$lib/buffer'

import { computeBoundingBox } from './box'
import fragmentShader from './fragment.glsl'
import { createHeadGeometry, createShaftGeometry, toInstanced } from './geometry'
import vertexShader from './vertex.glsl'

const defaults = {
	LENGTH: 0.1,
	HEAD_LENGTH: 0.02,
	HEAD_WIDTH: 0.005,
	SHAFT_RADIUS: 0.001,
}

const origin = new Vector3()
const direction = new Vector3()
const min = new Vector3()
const max = new Vector3()

const createMaterial = (options: { isHead: boolean; useColorAttribute: boolean }) => {
	return new RawShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms: {
			headAtOrigin: { value: 1 },
			shaftRadius: { value: defaults.SHAFT_RADIUS },
			headLength: { value: defaults.HEAD_LENGTH },
			headWidth: { value: defaults.HEAD_WIDTH },
			arrowLength: { value: defaults.LENGTH },
			minimumArrowLength: { value: 1e-6 },
			uniformColor: { value: new Color() },
		},
		defines: {
			...(options.isHead ? { IS_HEAD: 1 } : {}),
			...(options.useColorAttribute ? { USE_COLOR_ATTRIBUTE: 1 } : {}),
		},
		side: FrontSide,
		depthTest: true,
		depthWrite: true,
	})
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
			const colors = new Uint8Array(this.count * SIZE.COLORS_RGB)
			const instanceColor = new InstancedBufferAttribute(colors, SIZE.COLORS_RGB, true)
			instanceColor.setUsage(DynamicDrawUsage)

			this.attributes.instanceColor = instanceColor
		}

		const shaftGeometry = toInstanced(createShaftGeometry(), this.count, this.attributes)
		shaftGeometry.computeBoundingBox = computeBoundingBox.bind(this, shaftGeometry)

		const headGeometry = toInstanced(createHeadGeometry(), this.count, this.attributes)
		headGeometry.computeBoundingBox = computeBoundingBox.bind(this, headGeometry)

		const shaftMaterial = createMaterial({
			isHead: false,
			useColorAttribute: !options.uniformColor,
		})
		const headMaterial = createMaterial({
			isHead: true,
			useColorAttribute: !options.uniformColor,
		})

		for (const { uniforms } of [shaftMaterial, headMaterial]) {
			uniforms.shaftRadius.value = this.shaftRadius
			uniforms.headLength.value = this.headLength
			uniforms.headWidth.value = this.headWidth
			uniforms.arrowLength.value = this.arrowLength

			if (options.uniformColor) {
				uniforms.uniformColor.value.set(options.uniformColor)
			}
		}

		this.shaftMesh = new Mesh(shaftGeometry, shaftMaterial)
		this.headMesh = new Mesh(headGeometry, headMaterial)

		this.shaftMesh.frustumCulled = false
		this.headMesh.frustumCulled = false

		this.shaftMesh.raycast = () => null
		this.headMesh.raycast = () => null

		this.add(this.shaftMesh, this.headMesh)
	}

	update(arrows: { poses?: Float32Array; colors?: Uint8Array; headAtPose?: boolean }) {
		if (arrows.poses) {
			this.poses.array.set(arrows.poses)
			this.poses.needsUpdate = true
		}

		if (arrows.colors && this.attributes.instanceColor) {
			this.attributes.instanceColor.array.set(arrows.colors)
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
