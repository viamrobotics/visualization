import type { TypedArray } from 'three'

export const BufferDataType = {
	INT: 'int',
	UINT: 'uint',
	FLOAT: 'float',
} as const

export type BufferDataType = (typeof BufferDataType)[keyof typeof BufferDataType]

export type BufferMetadata = {
	// Describes the dimensions and their order for each buffer, e.g. ["x", "y", "z", "ox", "oy", "oz", "theta", "r", "g", "b", "a"].
	fields: string[]
	// The size of each dimension in bytes. For example, for five float32 fields this would be [4, 4, 4, 4, 4].
	size: number[]
	// The data type of each dimension, corresponding to the 'fields' list.
	type: BufferDataType[]
	// For partial updates, this specifies the starting element offset in the client's buffer
	start?: number
}

/**
 * Parse buffer data using metadata to create a typed array.
 * Returns TypedArray for optimal Three.js compatibility.
 *
 * @param data - The raw buffer data as Uint8Array
 * @param metadata - Optional metadata describing the buffer structure
 * @returns TypedArray view of the data
 */
export const parseBuffer = (data: Uint8Array, metadata?: BufferMetadata): TypedArray => {
	if (!metadata || metadata.type.length === 0) {
		return data
	}

	const firstType = metadata.type[0]
	const allSameType = metadata.type.every((t) => t === firstType)
	const firstSize = metadata.size[0]
	const allSameSize = metadata.size.every((s) => s === firstSize)

	if (allSameType && allSameSize) {
		return createTypedArray(data, firstType, firstSize)
	}

	const stride = metadata.size.reduce((sum, size) => sum + size, 0)
	const elementCount = data.byteLength / stride
	const fieldCount = metadata.fields.length
	const result = new Float32Array(elementCount * fieldCount)

	let resultIdx = 0
	for (let i = 0; i < elementCount; i++) {
		let byteOffset = i * stride
		for (let j = 0; j < fieldCount; j++) {
			const type = metadata.type[j]
			const size = metadata.size[j]
			result[resultIdx++] = readValue(data, byteOffset, type, size)
			byteOffset += size
		}
	}

	return result
}

export const packBuffer = (data: TypedArray): Uint8Array<ArrayBuffer> => {
	return new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength)
}

const createTypedArray = (data: Uint8Array, type: BufferDataType, size: number): TypedArray => {
	const { buffer, byteOffset, byteLength } = data
	const needsAlignment = size > 1 && byteOffset % size !== 0
	const alignedBuffer = needsAlignment ? new Uint8Array(data).buffer : buffer
	const alignedOffset = needsAlignment ? 0 : byteOffset

	switch (type) {
		case BufferDataType.INT:
			if (size === 1) return new Int8Array(buffer, byteOffset, byteLength)
			if (size === 2) return new Int16Array(alignedBuffer, alignedOffset, byteLength / 2)
			if (size === 4) return new Int32Array(alignedBuffer, alignedOffset, byteLength / 4)
			break
		case BufferDataType.UINT:
			if (size === 1) return new Uint8Array(buffer, byteOffset, byteLength)
			if (size === 2) return new Uint16Array(alignedBuffer, alignedOffset, byteLength / 2)
			if (size === 4) return new Uint32Array(alignedBuffer, alignedOffset, byteLength / 4)
			break
		case BufferDataType.FLOAT:
			if (size === 4) return new Float32Array(alignedBuffer, alignedOffset, byteLength / 4)
			if (size === 8) return new Float64Array(alignedBuffer, alignedOffset, byteLength / 8)
			break
	}

	return new Float32Array(alignedBuffer, alignedOffset, byteLength / 4)
}

const readValue = <T extends TypedArray>(
	data: Uint8Array,
	offset: number,
	type: BufferDataType,
	size: number
): T[number] => {
	const view = new DataView(data.buffer, data.byteOffset + offset, size)

	switch (type) {
		case BufferDataType.INT:
			if (size === 1) return view.getInt8(0)
			if (size === 2) return view.getInt16(0, true)
			if (size === 4) return view.getInt32(0, true)
			break
		case BufferDataType.UINT:
			if (size === 1) return view.getUint8(0)
			if (size === 2) return view.getUint16(0, true)
			if (size === 4) return view.getUint32(0, true)
			break
		case BufferDataType.FLOAT:
			if (size === 4) return view.getFloat32(0, true)
			if (size === 8) return view.getFloat64(0, true)
			break
	}

	return 0
}
