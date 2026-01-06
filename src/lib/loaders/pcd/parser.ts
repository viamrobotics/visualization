/**
 * PCD (Point Cloud Data) parser with pre-allocated typed arrays.
 *
 * This parser is adapted from Three.js PCDLoader but optimized for large point clouds
 * by pre-allocating all data arrays based on the header's POINTS value, avoiding
 * the memory overhead and GC pressure of dynamic array growth.
 *
 * Supports:
 * - ASCII, binary, and binary_compressed formats
 * - Fields: x, y, z, rgb, normal_x, normal_y, normal_z, intensity, label
 */

/** Parsed PCD data with pre-allocated typed arrays. */
export interface ParsedPCD {
	positions: Float32Array<ArrayBuffer>
	colors: Float32Array<ArrayBuffer> | null
	normals: Float32Array | null
	intensity: Float32Array | null
	labels: Int32Array | null
}

/** How often to yield to the event loop during parsing (every N points). */
const YIELD_INTERVAL = 100_000

/**
 * Yield to the event loop to prevent blocking.
 * Uses setTimeout(0) which allows pending messages and rendering to process.
 */
const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Decompress LZF-compressed data.
 * @see https://github.com/mrdoob/three.js/blob/master/examples/jsm/loaders/PCDLoader.js#L176-L227
 */
const decompressLZF = (inData: Uint8Array, outLength: number): Uint8Array => {
	const inLength = inData.length
	const outData = new Uint8Array(outLength)
	let inPtr = 0
	let outPtr = 0
	let ctrl: number
	let len: number
	let ref: number

	do {
		ctrl = inData[inPtr++]!
		if (ctrl < 1 << 5) {
			ctrl++
			if (outPtr + ctrl > outLength) throw new Error('Output buffer is not large enough')
			if (inPtr + ctrl > inLength) throw new Error('Invalid compressed data')
			do {
				outData[outPtr++] = inData[inPtr++]!
			} while (--ctrl)
		} else {
			len = ctrl >> 5
			ref = outPtr - ((ctrl & 0x1f) << 8) - 1
			if (inPtr >= inLength) throw new Error('Invalid compressed data')
			if (len === 7) {
				len += inData[inPtr++]!
				if (inPtr >= inLength) throw new Error('Invalid compressed data')
			}
			ref -= inData[inPtr++]!
			if (outPtr + len + 2 > outLength) throw new Error('Output buffer is not large enough')
			if (ref < 0) throw new Error('Invalid compressed data')
			if (ref >= outPtr) throw new Error('Invalid compressed data')
			do {
				outData[outPtr++] = outData[ref++]!
			} while (--len + 2)
		}
	} while (inPtr < inLength)

	return outData
}

/**
 * Supported PCD field names.
 * Could be extended, see: https://pointclouds.org/documentation/tutorials/pcd_file_format.html
 */
const SUPPORTED_PCD_FIELDS = [
	'x',
	'y',
	'z',
	'rgb',
	'normal_x',
	'normal_y',
	'normal_z',
	'intensity',
	'label',
] as const

type PCDFieldName = (typeof SUPPORTED_PCD_FIELDS)[number]
type PCDOffsets = Partial<Record<PCDFieldName, number>>

const isPCDField = (field: string): field is PCDFieldName =>
	SUPPORTED_PCD_FIELDS.includes(field as PCDFieldName)

/** PCD header metadata extracted from the file. */
interface PCDHeader {
	version: number | null
	fields: string[]
	size: number[]
	type: string[]
	count: number[]
	width: number
	height: number
	points: number
	data: 'ascii' | 'binary' | 'binary_compressed'
	offset: PCDOffsets
	rowSize: number
	headerLen: number
}

/**
 * Parse the PCD file header.
 * @param binaryData - Raw PCD file data as ArrayBuffer
 * @returns Parsed header metadata
 *
 * @see https://github.com/mrdoob/three.js/blob/master/examples/jsm/loaders/PCDLoader.js#L229-L366
 */
export const parseHeader = (binaryData: ArrayBuffer): PCDHeader => {
	const buffer = new Uint8Array(binaryData)

	let data = ''
	let line = ''
	let i = 0
	let end = false
	const max = buffer.length

	while (i < max && !end) {
		const char = String.fromCharCode(buffer[i++]!)

		if (char === '\n' || char === '\r') {
			if (line.trim().toLowerCase().startsWith('data')) {
				end = true
			}
			line = ''
		} else {
			line += char
		}

		data += char
	}

	const result1 = data.search(/[\r\n]DATA\s(\S*)\s/i)
	const result2 = /[\r\n]DATA\s(\S*)\s/i.exec(data.slice(result1 - 1))

	if (!result2) {
		throw new Error('Invalid PCD file: DATA field not found')
	}

	const headerLen = result2[0].length + result1
	const headerStr = data.slice(0, headerLen).replace(/#.*/gi, '')

	const header: PCDHeader = {
		version: null,
		fields: [],
		size: [],
		type: [],
		count: [],
		width: 0,
		height: 0,
		points: 0,
		data: result2[1]!.toLowerCase() as PCDHeader['data'],
		offset: {},
		rowSize: 0,
		headerLen,
	}

	// Parse version
	const versionMatch = /^VERSION (.*)/im.exec(headerStr)
	if (versionMatch) {
		header.version = parseFloat(versionMatch[1]!)
	}

	// Parse fields
	const fieldsMatch = /^FIELDS (.*)/im.exec(headerStr)
	if (fieldsMatch) {
		header.fields = fieldsMatch[1]!.split(' ')
	}

	// Parse size
	const sizeMatch = /^SIZE (.*)/im.exec(headerStr)
	if (sizeMatch) {
		header.size = sizeMatch[1]!.split(' ').map((x) => parseInt(x, 10))
	}

	// Parse type
	const typeMatch = /^TYPE (.*)/im.exec(headerStr)
	if (typeMatch) {
		header.type = typeMatch[1]!.split(' ')
	}

	// Parse count
	const countMatch = /^COUNT (.*)/im.exec(headerStr)
	if (countMatch) {
		header.count = countMatch[1]!.split(' ').map((x) => parseInt(x, 10))
	} else {
		// Default count to 1 for each field
		header.count = header.fields.map(() => 1)
	}

	// Parse width
	const widthMatch = /^WIDTH (.*)/im.exec(headerStr)
	if (widthMatch) {
		header.width = parseInt(widthMatch[1]!, 10)
	}

	// Parse height
	const heightMatch = /^HEIGHT (.*)/im.exec(headerStr)
	if (heightMatch) {
		header.height = parseInt(heightMatch[1]!, 10)
	}

	// Parse points
	const pointsMatch = /^POINTS (.*)/im.exec(headerStr)
	if (pointsMatch) {
		header.points = parseInt(pointsMatch[1]!, 10)
	} else {
		header.points = header.width * header.height
	}

	// Calculate offsets for each field (only store known fields)
	let sizeSum = 0
	for (let j = 0; j < header.fields.length; j++) {
		const field = header.fields[j]!
		if (isPCDField(field)) {
			if (header.data === 'ascii') {
				header.offset[field] = j
			} else {
				header.offset[field] = sizeSum
			}
		}
		// Always accumulate size for binary format (including unknown fields)
		if (header.data !== 'ascii') {
			sizeSum += header.size[j]! * header.count[j]!
		}
	}

	header.rowSize = sizeSum

	return header
}

/**
 * Get value from DataView based on field type and size.
 *
 * @see https://github.com/mrdoob/three.js/blob/master/examples/jsm/loaders/PCDLoader.js#L229-L366
 */
const getDataViewValue = (
	dataview: DataView,
	offset: number,
	type: string,
	size: number,
	littleEndian: boolean
): number => {
	switch (type) {
		case 'F': {
			if (size === 8) {
				return dataview.getFloat64(offset, littleEndian)
			}
			return dataview.getFloat32(offset, littleEndian)
		}
		case 'I': {
			if (size === 1) {
				return dataview.getInt8(offset)
			}
			if (size === 2) {
				return dataview.getInt16(offset, littleEndian)
			}
			return dataview.getInt32(offset, littleEndian)
		}
		case 'U': {
			if (size === 1) {
				return dataview.getUint8(offset)
			}
			if (size === 2) {
				return dataview.getUint16(offset, littleEndian)
			}
			return dataview.getUint32(offset, littleEndian)
		}
		default:
			return 0
	}
}

/**
 * Parse PCD file data into typed arrays.
 * @param data - Raw PCD file data as ArrayBuffer
 * @param littleEndian - Whether to use little endian byte order (default: true)
 * @returns Parsed point cloud data with pre-allocated typed arrays
 *
 * This function is async and yields to the event loop periodically to prevent
 * blocking the browser/worker thread during large file parsing.
 *
 * @see https://github.com/mrdoob/three.js/blob/master/examples/jsm/loaders/PCDLoader.js
 */
export const parsePcd = async (data: ArrayBuffer, littleEndian = true): Promise<ParsedPCD> => {
	const header = parseHeader(data)
	const { points, offset, fields, type, size } = header

	// Pre-allocate arrays based on which fields exist
	const hasPosition = offset.x !== undefined
	const hasColor = offset.rgb !== undefined
	const hasNormal = offset.normal_x !== undefined
	const hasIntensity = offset.intensity !== undefined
	const hasLabel = offset.label !== undefined

	const positions = hasPosition ? new Float32Array(points * 3) : new Float32Array(0)
	const colors = hasColor ? new Float32Array(points * 3) : null
	const normals = hasNormal ? new Float32Array(points * 3) : null
	const intensity = hasIntensity ? new Float32Array(points) : null
	const labels = hasLabel ? new Int32Array(points) : null

	// Parse ASCII format
	if (header.data === 'ascii') {
		const textData = new TextDecoder().decode(data)
		const pcdData = textData.slice(header.headerLen)
		const lines = pcdData.split('\n')

		let pointIndex = 0
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]!.trim()
			if (line === '') continue

			const values = line.split(' ')

			if (hasPosition) {
				const baseIdx = pointIndex * 3
				positions[baseIdx] = parseFloat(values[offset.x!]!)
				positions[baseIdx + 1] = parseFloat(values[offset.y!]!)
				positions[baseIdx + 2] = parseFloat(values[offset.z!]!)
			}

			if (hasColor && colors) {
				const rgbFieldIndex = fields.indexOf('rgb')
				const rgbType = type[rgbFieldIndex]

				const float = parseFloat(values[offset.rgb!]!)
				let rgb = float

				if (rgbType === 'F') {
					// Treat float values as int
					const farr = new Float32Array(1)
					farr[0] = float
					rgb = new Int32Array(farr.buffer)[0]!
				}

				const r = ((rgb >> 16) & 0x0000ff) / 255
				const g = ((rgb >> 8) & 0x0000ff) / 255
				const b = (rgb & 0x0000ff) / 255

				const baseIdx = pointIndex * 3
				colors[baseIdx] = r
				colors[baseIdx + 1] = g
				colors[baseIdx + 2] = b
			}

			if (hasNormal && normals) {
				const baseIdx = pointIndex * 3
				normals[baseIdx] = parseFloat(values[offset.normal_x!]!)
				normals[baseIdx + 1] = parseFloat(values[offset.normal_y!]!)
				normals[baseIdx + 2] = parseFloat(values[offset.normal_z!]!)
			}

			if (hasIntensity && intensity) {
				intensity[pointIndex] = parseFloat(values[offset.intensity!]!)
			}

			if (hasLabel && labels) {
				labels[pointIndex] = parseInt(values[offset.label!]!, 10)
			}

			pointIndex++

			// Yield periodically to prevent blocking
			if (pointIndex % YIELD_INTERVAL === 0) {
				await yieldToEventLoop()
			}
		}
	}

	// Parse binary_compressed format
	if (header.data === 'binary_compressed') {
		const sizes = new Uint32Array(data.slice(header.headerLen, header.headerLen + 8))
		const compressedSize = sizes[0]!
		const decompressedSize = sizes[1]!
		const decompressed = decompressLZF(
			new Uint8Array(data, header.headerLen + 8, compressedSize),
			decompressedSize
		)
		const dataview = new DataView(decompressed.buffer)

		for (let i = 0; i < points; i++) {
			if (hasPosition) {
				const xIndex = fields.indexOf('x')
				const yIndex = fields.indexOf('y')
				const zIndex = fields.indexOf('z')
				const baseIdx = i * 3
				positions[baseIdx] = getDataViewValue(
					dataview,
					points * offset.x! + size[xIndex]! * i,
					type[xIndex]!,
					size[xIndex]!,
					littleEndian
				)
				positions[baseIdx + 1] = getDataViewValue(
					dataview,
					points * offset.y! + size[yIndex]! * i,
					type[yIndex]!,
					size[yIndex]!,
					littleEndian
				)
				positions[baseIdx + 2] = getDataViewValue(
					dataview,
					points * offset.z! + size[zIndex]! * i,
					type[zIndex]!,
					size[zIndex]!,
					littleEndian
				)
			}

			if (hasColor && colors) {
				const rgbIndex = fields.indexOf('rgb')
				const rgbOffset = points * offset.rgb! + size[rgbIndex]! * i

				const r = dataview.getUint8(rgbOffset + 2) / 255
				const g = dataview.getUint8(rgbOffset + 1) / 255
				const b = dataview.getUint8(rgbOffset) / 255

				const baseIdx = i * 3
				colors[baseIdx] = r
				colors[baseIdx + 1] = g
				colors[baseIdx + 2] = b
			}

			if (hasNormal && normals) {
				const xIndex = fields.indexOf('normal_x')
				const yIndex = fields.indexOf('normal_y')
				const zIndex = fields.indexOf('normal_z')
				const baseIdx = i * 3
				normals[baseIdx] = getDataViewValue(
					dataview,
					points * offset.normal_x! + size[xIndex]! * i,
					type[xIndex]!,
					size[xIndex]!,
					littleEndian
				)
				normals[baseIdx + 1] = getDataViewValue(
					dataview,
					points * offset.normal_y! + size[yIndex]! * i,
					type[yIndex]!,
					size[yIndex]!,
					littleEndian
				)
				normals[baseIdx + 2] = getDataViewValue(
					dataview,
					points * offset.normal_z! + size[zIndex]! * i,
					type[zIndex]!,
					size[zIndex]!,
					littleEndian
				)
			}

			if (hasIntensity && intensity) {
				const intensityIndex = fields.indexOf('intensity')
				intensity[i] = getDataViewValue(
					dataview,
					points * offset.intensity! + size[intensityIndex]! * i,
					type[intensityIndex]!,
					size[intensityIndex]!,
					littleEndian
				)
			}

			if (hasLabel && labels) {
				const labelIndex = fields.indexOf('label')
				labels[i] = dataview.getInt32(points * offset.label! + size[labelIndex]! * i, littleEndian)
			}

			// Yield periodically to prevent blocking
			if (i % YIELD_INTERVAL === 0 && i > 0) {
				await yieldToEventLoop()
			}
		}
	}

	// Parse binary format
	if (header.data === 'binary') {
		const dataview = new DataView(data, header.headerLen)

		for (let i = 0, row = 0; i < points; i++, row += header.rowSize) {
			if (hasPosition) {
				const xIndex = fields.indexOf('x')
				const yIndex = fields.indexOf('y')
				const zIndex = fields.indexOf('z')
				const baseIdx = i * 3
				positions[baseIdx] = getDataViewValue(
					dataview,
					row + offset.x!,
					type[xIndex]!,
					size[xIndex]!,
					littleEndian
				)
				positions[baseIdx + 1] = getDataViewValue(
					dataview,
					row + offset.y!,
					type[yIndex]!,
					size[yIndex]!,
					littleEndian
				)
				positions[baseIdx + 2] = getDataViewValue(
					dataview,
					row + offset.z!,
					type[zIndex]!,
					size[zIndex]!,
					littleEndian
				)
			}

			if (hasColor && colors) {
				const r = dataview.getUint8(row + offset.rgb! + 2) / 255
				const g = dataview.getUint8(row + offset.rgb! + 1) / 255
				const b = dataview.getUint8(row + offset.rgb!) / 255

				const baseIdx = i * 3
				colors[baseIdx] = r
				colors[baseIdx + 1] = g
				colors[baseIdx + 2] = b
			}

			if (hasNormal && normals) {
				const xIndex = fields.indexOf('normal_x')
				const yIndex = fields.indexOf('normal_y')
				const zIndex = fields.indexOf('normal_z')
				const baseIdx = i * 3
				normals[baseIdx] = getDataViewValue(
					dataview,
					row + offset.normal_x!,
					type[xIndex]!,
					size[xIndex]!,
					littleEndian
				)
				normals[baseIdx + 1] = getDataViewValue(
					dataview,
					row + offset.normal_y!,
					type[yIndex]!,
					size[yIndex]!,
					littleEndian
				)
				normals[baseIdx + 2] = getDataViewValue(
					dataview,
					row + offset.normal_z!,
					type[zIndex]!,
					size[zIndex]!,
					littleEndian
				)
			}

			if (hasIntensity && intensity) {
				const intensityIndex = fields.indexOf('intensity')
				intensity[i] = getDataViewValue(
					dataview,
					row + offset.intensity!,
					type[intensityIndex]!,
					size[intensityIndex]!,
					littleEndian
				)
			}

			if (hasLabel && labels) {
				labels[i] = dataview.getInt32(row + offset.label!, littleEndian)
			}

			// Yield periodically to prevent blocking
			if (i % YIELD_INTERVAL === 0 && i > 0) {
				await yieldToEventLoop()
			}
		}
	}

	return {
		positions,
		colors,
		normals,
		intensity,
		labels,
	}
}
