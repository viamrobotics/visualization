import {
	commonApi,
	PointCloud,
	type PointCloudHeader,
	type TransformWithUUID,
} from '@viamrobotics/sdk'
import {
	BufferGeometry,
	BufferAttribute,
	InterleavedBuffer,
	InterleavedBufferAttribute,
	type TypedArray,
} from 'three'

type TypedArrayConstructor<T extends TypedArray = TypedArray> = {
	new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): T
	readonly BYTES_PER_ELEMENT: number
}

type BuiltPointCloud = {
	buffer: BufferGeometry
	interleaved: InterleavedBuffer
	points: number
	strideBytes: number
	strideElements: number
	structure?: PointCloudStructure
	colorFieldOffset?: number
}

type PointCloudGeometry = TransformWithUUID & {
	physicalObject: {
		geometryType: {
			case: 'pointcloud'
			value: { pointCloud: PointCloud; header?: PointCloudHeader }
		}
	}
}

type PointCloudGeometryWithHeader = TransformWithUUID & {
	physicalObject: {
		geometryType: {
			case: 'pointcloud'
			value: { pointCloud: PointCloud; header: PointCloudHeader }
		}
	}
}

type PointCloudStructure = {
	field: string
	offsetBytes: number
	offsetElements: number
	itemSize: number
}[]

export const isPointCloud = (transform?: TransformWithUUID): transform is PointCloudGeometry => {
	return transform?.physicalObject?.geometryType?.case === 'pointcloud'
}

export const hasPointCloudHeader = (
	transform: TransformWithUUID
): transform is PointCloudGeometryWithHeader => {
	if (!isPointCloud(transform)) return false
	return transform.physicalObject.geometryType.value.header !== undefined
}

export const getPointCloud = (transform: TransformWithUUID) => {
	if (!isPointCloud(transform)) return undefined
	return transform.physicalObject.geometryType.value.pointCloud
}

export const getPointCloudHeader = (transform: TransformWithUUID) => {
	if (!hasPointCloudHeader(transform)) return undefined
	return transform.physicalObject.geometryType.value.header
}

export const buildPointCloud = (data: Uint8Array, header?: PointCloudHeader): BuiltPointCloud => {
	// Fallback for payloads without header: interpret as Float32 XYZ
	if (!header) {
		const aligned =
			data.byteOffset % Float32Array.BYTES_PER_ELEMENT === 0 ? data : new Uint8Array(data)

		const array = new Float32Array(
			aligned.buffer,
			aligned.byteOffset,
			Math.floor(aligned.byteLength / Float32Array.BYTES_PER_ELEMENT)
		)

		if (array.length % 3 !== 0) {
			throw new Error('Legacy point cloud without header must be float32 XYZ (length % 3 == 0)')
		}

		const points = Math.floor(array.length / 3)
		const interleaved = new InterleavedBuffer(array, 3)
		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new InterleavedBufferAttribute(interleaved, 3, 0))
		return {
			buffer: geometry,
			interleaved,
			points,
			strideBytes: 3 * Float32Array.BYTES_PER_ELEMENT,
			strideElements: 3,
		}
	}

	const { baseType, baseSize } = assertUniformity(header)
	const strideBytes = computeStrideBytes(header)
	if (strideBytes <= 0) throw new Error('Invalid header: non-positive stride')

	const ArrayType = typedArrayFor(baseType, baseSize)
	const points = header.width * header.height
	const strideElements = Math.floor(strideBytes / ArrayType.BYTES_PER_ELEMENT)
	const expectedLength = points * strideElements
	const availableElementsRaw = Math.floor(data.byteLength / ArrayType.BYTES_PER_ELEMENT)
	if (availableElementsRaw !== expectedLength) {
		throw new Error(
			`Binary size mismatch. expected elements ${expectedLength}, got ${availableElementsRaw}`
		)
	}

	const aligned = data.byteOffset % ArrayType.BYTES_PER_ELEMENT === 0 ? data : new Uint8Array(data)
	const array = new ArrayType(aligned.buffer, aligned.byteOffset, expectedLength)
	const interleaved = new InterleavedBuffer(array, strideElements)
	const geometry = new BufferGeometry()
	const structure = getStructure(header)

	setPosition(geometry, interleaved, structure)
	setFieldAttributes(geometry, interleaved, structure)

	const rgbField = structure.find((f) => f.field.toLowerCase() === 'rgb' && f.itemSize === 1)
	let rgbFieldOffset: number | undefined
	if (rgbField) {
		const bytesPerElement = (interleaved.array as TypedArray).BYTES_PER_ELEMENT
		if (bytesPerElement === 4) {
			rgbFieldOffset = rgbField.offsetElements
			const colors = extractRgbColors(interleaved, rgbFieldOffset, 0, points)
			geometry.setAttribute('color', new BufferAttribute(colors, 3))
		}
	}

	return {
		buffer: geometry,
		interleaved,
		points,
		strideBytes,
		strideElements,
		structure,
		colorFieldOffset: rgbFieldOffset,
	}
}

export const updatePointCloudColors = (
	interleaved: InterleavedBuffer,
	rgbFieldOffset: number | undefined,
	startPoint: number,
	countPoints: number,
	colors?: BufferAttribute
) => {
	if (!colors || countPoints <= 0 || rgbFieldOffset === undefined) return

	const bytesPerElement = (interleaved.array as TypedArray).BYTES_PER_ELEMENT
	if (bytesPerElement !== 4) return

	const extracted = extractRgbColors(interleaved, rgbFieldOffset, startPoint, countPoints)
	const colorOffset = startPoint * 3
	colors.array.set(extracted, colorOffset)
	colors.addUpdateRange(colorOffset, countPoints * 3)
	colors.needsUpdate = true
}

export const updatePointCloud = (
	interleaved: InterleavedBuffer,
	data: Uint8Array,
	header?: PointCloudHeader
) => {
	if (header?.start === undefined) {
		console.error('Partial update requires header.start')
		return
	}

	const startPoint = header.start
	const updatePoints = (header.width || 0) * (header.height || 1)
	if (updatePoints <= 0) return

	const bytesPerElement = interleaved.array.BYTES_PER_ELEMENT
	const aligned = data.byteOffset % bytesPerElement === 0 ? data : new Uint8Array(data)
	const Constructor = interleaved.array.constructor as TypedArrayConstructor
	const src = new Constructor(
		aligned.buffer,
		aligned.byteOffset,
		Math.floor(aligned.byteLength / bytesPerElement)
	)

	const strideElements = interleaved.stride
	const offsetElements = startPoint * strideElements
	const countElements = updatePoints * strideElements

	for (let p = 0; p < updatePoints; p++) {
		const srcBase = p * strideElements
		const dstBase = (startPoint + p) * strideElements
		for (let i = 0; i < strideElements; i++) {
			interleaved.array[dstBase + i] = src[srcBase + i]
		}
	}

	interleaved.addUpdateRange(offsetElements, countElements)
	interleaved.needsUpdate = true
}

const assertUniformity = (header: PointCloudHeader) => {
	if (
		header.fields.length !== header.size.length ||
		header.fields.length !== header.type.length ||
		header.fields.length !== header.count.length
	) {
		throw new Error('Invalid header: arrays must be equal length')
	}

	const baseType = header.type[0]
	const baseSize = header.size[0]
	for (let i = 1; i < header.fields.length; i++) {
		if (header.type[i] !== baseType) {
			throw new Error('Mixed field types are not supported for interleaved buffers')
		}
		if (header.size[i] !== baseSize) {
			throw new Error('Mixed field element sizes are not supported for interleaved buffers')
		}
	}

	return { baseType, baseSize }
}

const typedArrayFor = (
	dataType: commonApi.PointCloudDataType,
	bytesPerElement: number
): TypedArrayConstructor => {
	if (dataType === commonApi.PointCloudDataType.FLOAT) {
		if (bytesPerElement === 4) return Float32Array
		if (bytesPerElement === 8) return Float64Array
	}
	if (dataType === commonApi.PointCloudDataType.INT) {
		if (bytesPerElement === 1) return Int8Array
		if (bytesPerElement === 2) return Int16Array
		if (bytesPerElement === 4) return Int32Array
	}
	if (dataType === commonApi.PointCloudDataType.UINT) {
		if (bytesPerElement === 1) return Uint8Array
		if (bytesPerElement === 2) return Uint16Array
		if (bytesPerElement === 4) return Uint32Array
	}
	throw new Error(`Unsupported type/size combination: ${dataType}/${bytesPerElement}`)
}

const computeStrideBytes = (header: PointCloudHeader) => {
	let stride = 0
	for (let i = 0; i < header.fields.length; i++) {
		stride += header.size[i] * header.count[i]
	}
	return stride
}

const getStructure = (header: PointCloudHeader) => {
	const { baseSize } = assertUniformity(header)
	const bytesPerElement = baseSize
	const structure: PointCloudStructure = []
	let runningOffsetBytes = 0
	for (let i = 0; i < header.fields.length; i++) {
		const field = header.fields[i]
		const count = header.count[i]
		const size = header.size[i]
		const itemSize = (size / bytesPerElement) * count
		structure.push({
			field,
			offsetBytes: runningOffsetBytes,
			offsetElements: runningOffsetBytes / bytesPerElement,
			itemSize,
		})

		runningOffsetBytes += size * count
	}

	return structure
}

const setPosition = (
	geometry: BufferGeometry,
	interleaved: InterleavedBuffer,
	structure: PointCloudStructure
) => {
	const xIndex = structure.findIndex((f) => f.field.toLowerCase() === 'x')
	if (xIndex === -1) return

	const y = structure[xIndex + 1]
	const z = structure[xIndex + 2]
	const x = structure[xIndex]

	if (!y || !z) return
	if (y.field.toLowerCase() !== 'y' || z.field.toLowerCase() !== 'z') return
	if (x.itemSize !== 1 || y.itemSize !== 1 || z.itemSize !== 1) return
	if (y.offsetElements !== x.offsetElements + 1) return
	if (z.offsetElements !== x.offsetElements + 2) return

	geometry.setAttribute(
		'position',
		new InterleavedBufferAttribute(interleaved, 3, x.offsetElements)
	)
}

const setFieldAttributes = (
	geometry: BufferGeometry,
	interleaved: InterleavedBuffer,
	structure: PointCloudStructure
) => {
	for (const { field, itemSize, offsetElements } of structure) {
		const name = field.toLowerCase()
		if (name === 'x' || name === 'y' || name === 'z') continue
		if (name === 'rgb') continue // handled specially as 'color'
		geometry.setAttribute(
			field,
			new InterleavedBufferAttribute(interleaved, itemSize, offsetElements)
		)
	}
}

const extractRgbColors = (
	interleaved: InterleavedBuffer,
	rgbOffsetElements: number,
	startPoint: number,
	countPoints: number
): Float32Array => {
	const strideElements = interleaved.stride
	const colors = new Float32Array(countPoints * 3)
	const asUint32 = new Uint32Array(
		interleaved.array.buffer,
		interleaved.array.byteOffset,
		interleaved.array.length
	)

	for (let i = 0; i < countPoints; i++) {
		const pointIndex = startPoint + i
		const idx = pointIndex * strideElements + rgbOffsetElements
		const packed = asUint32[idx]

		// RGB extraction (0x00RRGGBB format)
		const r = (packed >>> 16) & 0xff
		const g = (packed >>> 8) & 0xff
		const b = packed & 0xff

		const base = i * 3
		colors[base] = r / 255
		colors[base + 1] = g / 255
		colors[base + 2] = b / 255
	}

	return colors
}
