import {
	Color,
	type ColorRepresentation,
	DynamicDrawUsage,
	InterleavedBufferAttribute,
	Matrix4,
	Quaternion,
	Vector3,
} from 'three'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'

type BatchedAxesHelpersOptions = {
	capacity?: number
	axisLength?: number
	linewidth?: number
	worldUnits?: boolean
	frustumCulled?: boolean
	/** Set `false` to draw the axes over occluding geometry. */
	depthTest?: boolean
	depthWrite?: boolean
	transparent?: boolean
	xColor?: ColorRepresentation
	yColor?: ColorRepresentation
	zColor?: ColorRepresentation
}

const SEGMENTS_PER_AXES = 3
const FLOATS_PER_SEGMENT = 6
const FLOATS_PER_AXES = SEGMENTS_PER_AXES * FLOATS_PER_SEGMENT

const matrix4 = new Matrix4()
const scale3 = new Vector3()
const start = new Vector3()
const end = new Vector3()
const xColor = new Color()
const yColor = new Color()
const zColor = new Color()

/**
 * Sends a zero-length segment to `(2, 2, 2)` in clip space, outside the [-1, 1]
 * volume, so the whole instance is rejected before rasterization. Every vertex
 * of the instance lands there, so the primitive is clipped rather than
 * interpolated against the frustum.
 */
export const rejectCollapsedSegments = (vertexShader: string): string =>
	vertexShader.replace(
		'void main() {',
		'void main() {\n\tif ( instanceStart == instanceEnd ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }'
	)

/**
 * A hidden or freed slot is collapsed to a zero-length segment (see
 * `writeAxesPositions`), but `LineSegments2` draws a round cap for one, leaving
 * a dot of `linewidth` pixels behind wherever the helper used to be. Reject
 * those instances in the vertex shader instead.
 *
 * `customProgramCacheKey` has to move with `onBeforeCompile`. Without it three
 * may hand this material a program compiled for an unpatched `LineMaterial`,
 * and the scene draws lines with one of those too.
 */
const hideCollapsedHelpers = (material: LineMaterial): void => {
	material.onBeforeCompile = (parameters) => {
		parameters.vertexShader = rejectCollapsedSegments(parameters.vertexShader)
	}

	material.customProgramCacheKey = () => 'batched-axes-helpers'
}

export class BatchedAxesHelpers extends LineSegments2 {
	capacity: number

	/** High-water mark: slots in [0, size) have been allocated; some may be free holes. Drives instanceCount. */
	size = 0

	/** Number of live helpers (size minus freed holes). */
	count = 0

	axisLength: number

	private positions: Float32Array
	private colors: Float32Array
	private matrices: Float32Array
	private lengths: Float32Array
	private visibles: Uint8Array
	private freeIndices: number[] = []

	constructor(options: BatchedAxesHelpersOptions = {}) {
		const capacity = options.capacity ?? 128
		const axisLength = options.axisLength ?? 0.1

		const positions = new Float32Array(capacity * FLOATS_PER_AXES)
		const colors = new Float32Array(capacity * FLOATS_PER_AXES)

		const geometry = new LineSegmentsGeometry()
		geometry.setPositions(positions)
		geometry.setColors(colors)
		geometry.instanceCount = 0

		const material = new LineMaterial({
			linewidth: options.linewidth ?? 2,
			worldUnits: options.worldUnits ?? false,
			vertexColors: true,
			depthTest: options.depthTest ?? true,
			depthWrite: options.depthWrite ?? true,
			transparent: options.transparent ?? false,
		})

		hideCollapsedHelpers(material)

		super(geometry, material)

		this.visibles = new Uint8Array(capacity)
		this.visibles.fill(1)

		this.capacity = capacity
		this.axisLength = axisLength

		this.positions = positions
		this.colors = colors
		this.matrices = new Float32Array(capacity * 16)
		this.lengths = new Float32Array(capacity)

		this.frustumCulled = options.frustumCulled ?? false

		this.setDefaultColors(
			options.xColor ?? 0xff0000,
			options.yColor ?? 0x00ff00,
			options.zColor ?? 0x0000ff
		)

		this.markDynamic()
	}

	addHelper(matrix?: Matrix4, length = this.axisLength): number {
		// Reuse a freed slot when available so existing indices stay stable.
		let index = this.freeIndices.pop()

		if (index === undefined) {
			if (this.size >= this.capacity) {
				this.resize(Math.max(1, this.capacity * 2))
			}
			index = this.size++
		}

		this.count++
		this.lengths[index] = length
		this.visibles[index] = 1

		if (matrix) {
			this.setMatrixAt(index, matrix)
		} else {
			this.setMatrixAt(index, matrix4.identity())
		}

		this.geometry.instanceCount = this.size * SEGMENTS_PER_AXES

		return index
	}

	removeHelper(index: number): void {
		this.assertIndex(index)

		// Vacate the slot in place and return it to the free list. Indices never
		// move, so indices held elsewhere (e.g. an entity->index map) stay valid.
		this.visibles[index] = 0
		this.writeAxesPositions(index)
		this.freeIndices.push(index)
		this.count--

		this.markPositionsDirty()
	}

	clear(): this {
		this.size = 0
		this.count = 0
		this.freeIndices.length = 0
		this.geometry.instanceCount = 0
		return this
	}

	resize(newCapacity: number): void {
		if (newCapacity === this.capacity) return

		const oldCapacity = this.capacity
		const nextSize = Math.min(this.size, newCapacity)

		const nextPositions = new Float32Array(newCapacity * FLOATS_PER_AXES)
		const nextColors = new Float32Array(newCapacity * FLOATS_PER_AXES)
		const nextMatrices = new Float32Array(newCapacity * 16)
		const nextLengths = new Float32Array(newCapacity)
		const nextVisibles = new Uint8Array(newCapacity)
		nextVisibles.fill(1)

		nextPositions.set(this.positions.subarray(0, nextSize * FLOATS_PER_AXES))
		nextColors.set(this.colors.subarray(0, nextSize * FLOATS_PER_AXES))
		nextMatrices.set(this.matrices.subarray(0, nextSize * 16))
		nextLengths.set(this.lengths.subarray(0, nextSize))
		nextVisibles.set(this.visibles.subarray(0, nextSize))

		this.positions = nextPositions
		this.colors = nextColors
		this.matrices = nextMatrices
		this.lengths = nextLengths
		this.visibles = nextVisibles
		this.capacity = newCapacity
		this.size = nextSize

		if (newCapacity < oldCapacity) {
			this.freeIndices = this.freeIndices.filter((freeIndex) => freeIndex < nextSize)
		}

		const oldGeometry = this.geometry

		const geometry = new LineSegmentsGeometry()
		geometry.setPositions(this.positions)
		geometry.setColors(this.colors)
		geometry.instanceCount = this.size * SEGMENTS_PER_AXES

		this.geometry = geometry
		oldGeometry.dispose()

		this.markDynamic()

		// Preserve default color initialization for newly available slots.
		for (let i = oldCapacity; i < newCapacity; i++) {
			this.setColorsAt(i, xColor, yColor, zColor)
		}
	}

	setMatrixAt(index: number, matrix: Matrix4): void {
		this.assertCapacityIndex(index)

		matrix.toArray(this.matrices, index * 16)
		this.writeAxesPositions(index)
		this.markPositionsDirty()
	}

	getMatrixAt(index: number, target = new Matrix4()): Matrix4 {
		this.assertIndex(index)
		return target.fromArray(this.matrices, index * 16)
	}

	setTransformAt(
		index: number,
		position: Vector3,
		quaternion: Quaternion,
		scale: Vector3 | number = 1
	): void {
		this.assertCapacityIndex(index)

		if (typeof scale === 'number') {
			scale3.setScalar(scale)
		} else {
			scale3.copy(scale)
		}

		matrix4.compose(position, quaternion, scale3)
		this.setMatrixAt(index, matrix4)
	}

	setLengthAt(index: number, length: number): void {
		this.assertCapacityIndex(index)

		this.lengths[index] = length
		this.writeAxesPositions(index)
		this.markPositionsDirty()
	}

	getLengthAt(index: number): number {
		this.assertIndex(index)
		return this.lengths[index]
	}

	setColorsAt(
		index: number,
		x: ColorRepresentation,
		y: ColorRepresentation,
		z: ColorRepresentation
	): void {
		this.assertCapacityIndex(index)

		xColor.set(x)
		yColor.set(y)
		zColor.set(z)

		let offset = index * FLOATS_PER_AXES

		this.writeSegmentColor(offset, xColor)
		offset += FLOATS_PER_SEGMENT

		this.writeSegmentColor(offset, yColor)
		offset += FLOATS_PER_SEGMENT

		this.writeSegmentColor(offset, zColor)

		this.markColorsDirty()
	}

	setDefaultColors(x: ColorRepresentation, y: ColorRepresentation, z: ColorRepresentation): void {
		xColor.set(x)
		yColor.set(y)
		zColor.set(z)

		for (let i = 0; i < this.capacity; i++) {
			this.setColorsAt(i, xColor, yColor, zColor)
		}
	}

	setLinewidth(linewidth: number): void {
		this.material.linewidth = linewidth
	}

	setVisibleAt(index: number, visible: boolean): void {
		this.assertCapacityIndex(index)

		const next = visible ? 1 : 0
		if (this.visibles[index] === next) return

		this.visibles[index] = next
		this.writeAxesPositions(index)
		this.markPositionsDirty()
	}

	getVisibleAt(index: number): boolean {
		this.assertIndex(index)
		return this.visibles[index] === 1
	}

	private writeAxesPositions(index: number): void {
		matrix4.fromArray(this.matrices, index * 16)

		let offset = index * FLOATS_PER_AXES

		if (!this.visibles[index]) {
			start.set(0, 0, 0).applyMatrix4(matrix4)

			// X collapsed
			this.writeSegmentPosition(offset, start, start)
			offset += FLOATS_PER_SEGMENT

			// Y collapsed
			this.writeSegmentPosition(offset, start, start)
			offset += FLOATS_PER_SEGMENT

			// Z collapsed
			this.writeSegmentPosition(offset, start, start)

			return
		}

		const length = this.lengths[index] || this.axisLength

		start.set(0, 0, 0).applyMatrix4(matrix4)
		end.set(length, 0, 0).applyMatrix4(matrix4)
		this.writeSegmentPosition(offset, start, end)
		offset += FLOATS_PER_SEGMENT

		start.set(0, 0, 0).applyMatrix4(matrix4)
		end.set(0, length, 0).applyMatrix4(matrix4)
		this.writeSegmentPosition(offset, start, end)
		offset += FLOATS_PER_SEGMENT

		start.set(0, 0, 0).applyMatrix4(matrix4)
		end.set(0, 0, length).applyMatrix4(matrix4)
		this.writeSegmentPosition(offset, start, end)
	}

	private writeSegmentPosition(offset: number, start: Vector3, end: Vector3): void {
		this.positions[offset + 0] = start.x
		this.positions[offset + 1] = start.y
		this.positions[offset + 2] = start.z

		this.positions[offset + 3] = end.x
		this.positions[offset + 4] = end.y
		this.positions[offset + 5] = end.z
	}

	private writeSegmentColor(offset: number, color: Color): void {
		this.colors[offset + 0] = color.r
		this.colors[offset + 1] = color.g
		this.colors[offset + 2] = color.b

		this.colors[offset + 3] = color.r
		this.colors[offset + 4] = color.g
		this.colors[offset + 5] = color.b
	}

	private markDynamic(): void {
		const instanceStart = this.geometry.attributes.instanceStart as InterleavedBufferAttribute

		const instanceColorStart = this.geometry.attributes.instanceColorStart as
			| InterleavedBufferAttribute
			| undefined

		instanceStart.data.setUsage(DynamicDrawUsage)
		instanceColorStart?.data.setUsage(DynamicDrawUsage)
	}

	private markPositionsDirty(): void {
		const instanceStart = this.geometry.attributes.instanceStart as InterleavedBufferAttribute

		// instanceStart and instanceEnd share the same interleaved buffer.
		instanceStart.needsUpdate = true
	}

	private markColorsDirty(): void {
		const instanceColorStart = this.geometry.attributes.instanceColorStart as
			| InterleavedBufferAttribute
			| undefined

		// instanceColorStart and instanceColorEnd share the same interleaved buffer.
		if (instanceColorStart) instanceColorStart.needsUpdate = true
	}

	private assertIndex(index: number): void {
		if (index < 0 || index >= this.size) {
			throw new RangeError(`Axes helper index ${index} is outside size ${this.size}.`)
		}
	}

	private assertCapacityIndex(index: number): void {
		if (index < 0 || index >= this.capacity) {
			throw new RangeError(`Axes helper index ${index} is outside capacity ${this.capacity}.`)
		}
	}
}
