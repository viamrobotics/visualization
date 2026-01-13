import {
	RawShaderMaterial,
	FrontSide,
	Group,
	InstancedBufferAttribute,
	DynamicDrawUsage,
	Mesh,
	BufferGeometry,
	Vector3,
	Color,
	InstancedInterleavedBuffer,
	InterleavedBufferAttribute,
	Material,
} from 'three'
import vertexShader from './vertex.glsl?raw'
import fragmentShader from './fragment.glsl?raw'
import { createHeadGeometry, createShaftGeometry, toInstanced } from './geometry'

const defaults = {
	LENGTH: 0.1,
	HEAD_LENGTH: 0.02,
	HEAD_WIDTH: 0.005,
	SHAFT_RADIUS: 0.001,
}

const createMaterial = (options: { isHead: boolean }) => {
	return new RawShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms: {
			headAtOrigin: { value: 1.0 },
			shaftRadius: { value: defaults.SHAFT_RADIUS },
			headLength: { value: defaults.HEAD_LENGTH },
			headWidth: { value: defaults.HEAD_WIDTH },
			arrowLength: { value: defaults.LENGTH },
			minimumArrowLength: { value: 1e-6 },
		},
		defines: options.isHead ? { IS_HEAD: 1 } : {},
		side: FrontSide,
		depthTest: true,
		depthWrite: true,
	})
}

export class InstancedArrows extends Group {
	count: number

	origins: Float32Array
	directions: Float32Array
	colors: Float32Array

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
		} = {}
	) {
		super()

		const count = Math.max(0, options?.count ?? 0)
		this.count = count

		this.colors = new Float32Array(count * 3)

		const stride = 6
		const posesInterleaved = new Float32Array(count * stride)

		// Instanced interleaved buffer (important: 'instanceCount' is still controlled via geometry.instanceCount)
		this.poses = new InstancedInterleavedBuffer(posesInterleaved, stride)
		this.poses.setUsage(DynamicDrawUsage)

		// Create "views" into that same buffer
		const instanceOrigin = new InterleavedBufferAttribute(this.poses, 3, 0, false)
		const instanceDirection = new InterleavedBufferAttribute(this.poses, 3, 3, false)

		// const instanceOrigin = new InstancedBufferAttribute(this.origins, 3).setUsage(DynamicDrawUsage)
		// const instanceDirection = new InstancedBufferAttribute(this.directions, 3).setUsage(
		// 	DynamicDrawUsage
		// )
		const instanceColor = new InstancedBufferAttribute(this.colors, 3).setUsage(DynamicDrawUsage)

		const attributes: BufferGeometry['attributes'] = {
			instanceOrigin,
			instanceDirection,
			instanceColor,
		}

		const shaftGeometry = toInstanced(createShaftGeometry(), count, attributes)
		const headGeometry = toInstanced(createHeadGeometry(), count, attributes)

		const shaftMaterial = createMaterial({ isHead: false })
		const headMaterial = createMaterial({ isHead: true })

		for (const { uniforms } of [shaftMaterial, headMaterial]) {
			uniforms.shaftRadius.value = options?.shaftRadius ?? defaults.SHAFT_RADIUS
			uniforms.headLength.value = options?.headLength ?? defaults.HEAD_LENGTH
			uniforms.headWidth.value = options?.headWidth ?? defaults.HEAD_WIDTH
			uniforms.arrowLength.value = options?.length ?? defaults.LENGTH
		}

		this.shaftMesh = new Mesh(shaftGeometry, shaftMaterial)
		this.headMesh = new Mesh(headGeometry, headMaterial)

		this.shaftMesh.frustumCulled = false
		this.headMesh.frustumCulled = false

		this.add(this.shaftMesh, this.headMesh)

		this.attributes = { instanceOrigin, instanceDirection, instanceColor }
	}

	update(arrows: { poses?: Float32Array; colors?: Float32Array }) {
		if (arrows.poses) {
			for (let i = 0, l = arrows.poses.length; i < l; i += 6) {
				arrows.poses[i + 0] *= 0.001
				arrows.poses[i + 1] *= 0.001
				arrows.poses[i + 2] *= 0.001
			}

			this.poses.array.set(arrows.poses)
			this.poses.needsUpdate = true
			this.attributes.instanceOrigin.needsUpdate = true
			this.attributes.instanceDirection.needsUpdate = true
		}

		if (arrows.colors) {
			this.colors.set(arrows.colors)
			this.attributes.instanceColor.needsUpdate = true
		}
	}

	dispose() {
		this.shaftMesh.geometry.dispose()
		this.headMesh.geometry.dispose()
		;(this.shaftMesh.material as Material).dispose()
		;(this.headMesh.material as Material).dispose()
	}
}
