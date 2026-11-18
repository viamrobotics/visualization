import {
	Color,
	type ColorRepresentation,
	DynamicDrawUsage,
	InterleavedBufferAttribute,
	Matrix4,
	Vector3,
} from 'three'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js'
import { Line2NodeMaterial } from 'three/webgpu'

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
const FREED = -1

const matrix4 = new Matrix4()
const start = new Vector3()
const end = new Vector3()

/**
 * Draws many axes helpers as one `LineSegments2`.
 *
 * Callers hold a stable handle per helper, while the helper's segments move
 * between buffer slots. Visible helpers stay packed in `[0, visibleCount)` and
 * hidden ones in `[visibleCount, liveCount)`, so only visible helpers are drawn.
 */
export class BatchedAxesHelpers extends LineSegments2 {
	private capacity: number
	private axisLength: number
	private colors: [Color, Color, Color]

	private visibleCount = 0
	private liveCount = 0

	/** Segment positions, by slot. */
	private positions: Float32Array

	/** Per-helper state, by handle, so a slot swap only moves positions. */
	private matrices: Float32Array
	private lengths: Float32Array
	private visibles: Uint8Array

	private handleToSlot: Int32Array
	private slotToHandle: Int32Array
	private freeHandles: number[] = []

	constructor(options: BatchedAxesHelpersOptions = {}) {
		const capacity = Math.max(1, options.capacity ?? 128)

		const material = new Line2NodeMaterial({
			linewidth: options.linewidth ?? 2,
			worldUnits: options.worldUnits ?? false,
			vertexColors: true,
			depthTest: options.depthTest ?? true,
			depthWrite: options.depthWrite ?? true,
			transparent: options.transparent ?? false,
		})

		super(new LineSegmentsGeometry(), material)

		this.capacity = capacity
		this.axisLength = options.axisLength ?? 0.1
		this.colors = [
			new Color(options.xColor ?? 0xff0000),
			new Color(options.yColor ?? 0x00ff00),
			new Color(options.zColor ?? 0x0000ff),
		]

		this.positions = new Float32Array(capacity * FLOATS_PER_AXES)
		this.matrices = new Float32Array(capacity * 16)
		this.lengths = new Float32Array(capacity)
		this.visibles = new Uint8Array(capacity)
		this.handleToSlot = new Int32Array(capacity).fill(FREED)
		this.slotToHandle = new Int32Array(capacity).fill(FREED)

		this.frustumCulled = options.frustumCulled ?? false

		this.rebuildGeometry()
	}

	addHelper(matrix?: Matrix4, length = this.axisLength): number {
		if (this.liveCount === this.capacity) {
			this.grow()
		}

		// With no freed handles, every handle below liveCount is live.
		const handle = this.freeHandles.pop() ?? this.liveCount
		const slot = this.liveCount++

		this.handleToSlot[handle] = slot
		this.slotToHandle[slot] = handle
		this.lengths[handle] = length
		this.visibles[handle] = 0

		this.setMatrixAt(handle, matrix ?? matrix4.identity())
		this.setVisibleAt(handle, true)

		return handle
	}

	removeHelper(handle: number): void {
		this.assertHandle(handle)

		this.setVisibleAt(handle, false)

		this.swapSlots(this.handleToSlot[handle], this.liveCount - 1)
		this.liveCount--

		this.slotToHandle[this.liveCount] = FREED
		this.handleToSlot[handle] = FREED
		this.freeHandles.push(handle)
	}

	setMatrixAt(handle: number, matrix: Matrix4): void {
		this.assertHandle(handle)

		matrix.toArray(this.matrices, handle * 16)

		// Hidden helpers are written too, so showing one only has to swap it in.
		this.writeAxesPositions(handle)
		this.markPositionsDirty()
	}

	setVisibleAt(handle: number, visible: boolean): void {
		this.assertHandle(handle)

		const next = visible ? 1 : 0
		if (this.visibles[handle] === next) return

		this.visibles[handle] = next

		if (visible) {
			this.swapSlots(this.handleToSlot[handle], this.visibleCount)
			this.visibleCount++
		} else {
			this.swapSlots(this.handleToSlot[handle], this.visibleCount - 1)
			this.visibleCount--
		}

		this.geometry.instanceCount = this.visibleCount * SEGMENTS_PER_AXES
		this.markPositionsDirty()
	}

	private swapSlots(a: number, b: number): void {
		if (a === b) return

		const positions = this.positions
		const offsetA = a * FLOATS_PER_AXES
		const offsetB = b * FLOATS_PER_AXES

		for (let i = 0; i < FLOATS_PER_AXES; i++) {
			const value = positions[offsetA + i]
			positions[offsetA + i] = positions[offsetB + i]
			positions[offsetB + i] = value
		}

		const handleA = this.slotToHandle[a]
		const handleB = this.slotToHandle[b]

		this.slotToHandle[a] = handleB
		this.slotToHandle[b] = handleA
		this.handleToSlot[handleA] = b
		this.handleToSlot[handleB] = a
	}

	/** Doubles every buffer, keeping slots and handles where they are. */
	private grow(): void {
		const capacity = this.capacity * 2

		const positions = new Float32Array(capacity * FLOATS_PER_AXES)
		const matrices = new Float32Array(capacity * 16)
		const lengths = new Float32Array(capacity)
		const visibles = new Uint8Array(capacity)
		const handleToSlot = new Int32Array(capacity).fill(FREED)
		const slotToHandle = new Int32Array(capacity).fill(FREED)

		positions.set(this.positions)
		matrices.set(this.matrices)
		lengths.set(this.lengths)
		visibles.set(this.visibles)
		handleToSlot.set(this.handleToSlot)
		slotToHandle.set(this.slotToHandle)

		this.capacity = capacity
		this.positions = positions
		this.matrices = matrices
		this.lengths = lengths
		this.visibles = visibles
		this.handleToSlot = handleToSlot
		this.slotToHandle = slotToHandle

		this.rebuildGeometry()
	}

	/** Builds a geometry over the current buffers, which `LineSegmentsGeometry` can't resize in place. */
	private rebuildGeometry(): void {
		const colors = new Float32Array(this.capacity * FLOATS_PER_AXES)

		for (let offset = 0; offset < colors.length; offset += FLOATS_PER_SEGMENT) {
			const color = this.colors[(offset / FLOATS_PER_SEGMENT) % SEGMENTS_PER_AXES]
			color.toArray(colors, offset)
			color.toArray(colors, offset + 3)
		}

		const geometry = new LineSegmentsGeometry()
		geometry.setPositions(this.positions)
		geometry.setColors(colors)
		geometry.instanceCount = this.visibleCount * SEGMENTS_PER_AXES

		const instanceStart = geometry.attributes.instanceStart as InterleavedBufferAttribute
		instanceStart.data.setUsage(DynamicDrawUsage)

		const oldGeometry = this.geometry
		this.geometry = geometry
		oldGeometry.dispose()
	}

	private writeAxesPositions(handle: number): void {
		matrix4.fromArray(this.matrices, handle * 16)

		const length = this.lengths[handle]
		let offset = this.handleToSlot[handle] * FLOATS_PER_AXES

		start.set(0, 0, 0).applyMatrix4(matrix4)

		end.set(length, 0, 0).applyMatrix4(matrix4)
		this.writeSegmentPosition(offset, start, end)
		offset += FLOATS_PER_SEGMENT

		end.set(0, length, 0).applyMatrix4(matrix4)
		this.writeSegmentPosition(offset, start, end)
		offset += FLOATS_PER_SEGMENT

		end.set(0, 0, length).applyMatrix4(matrix4)
		this.writeSegmentPosition(offset, start, end)
	}

	private writeSegmentPosition(offset: number, start: Vector3, end: Vector3): void {
		start.toArray(this.positions, offset)
		end.toArray(this.positions, offset + 3)
	}

	private markPositionsDirty(): void {
		const instanceStart = this.geometry.attributes.instanceStart as InterleavedBufferAttribute

		// instanceStart and instanceEnd share the same interleaved buffer.
		instanceStart.needsUpdate = true
	}

	private assertHandle(handle: number): void {
		if (handle < 0 || handle >= this.capacity || this.handleToSlot[handle] === FREED) {
			throw new RangeError(`Axes helper handle ${handle} is not live.`)
		}
	}
}
