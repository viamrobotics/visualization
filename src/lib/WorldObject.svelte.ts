import type { PlainMessage, Struct } from '@viamrobotics/sdk'
import { BatchedMesh, Color, Vector3 } from 'three'
import type { GLTF } from 'three/examples/jsm/Addons.js'
import type { ValueOf } from 'type-fest'
import { isColorRepresentation, isRGB, parseColor, parseOpacity, parseRGB } from './color'
import type { OBB } from 'three/addons/math/OBB.js'

enum SupportedShapes {
	points = 'points',
	line = 'line',
	arrow = 'arrow',
}

type Metadata = {
	colors?: Float32Array<ArrayBufferLike>
	color?: Color
	opacity?: number
	gltf?: GLTF
	points?: Vector3[]
	pointSize?: number
	lineWidth?: number
	lineDotColor?: Color
	batched?: {
		id: number
		object: BatchedMesh
	}
	shape?: SupportedShapes
	getBoundingBoxAt?: (box: OBB) => void
}

const METADATA_KEYS = [
	'colors',
	'color',
	'opacity',
	'gltf',
	'points',
	'pointSize',
	'lineWidth',
	'lineDotColor',
	'batched',
	'shape',
] as const

const isMetadataKey = (key: string): key is keyof Metadata => {
	return METADATA_KEYS.includes(key as (typeof METADATA_KEYS)[number])
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrapValue = (value: PlainMessage<any>): unknown => {
	if (!value?.kind) return value

	switch (value.kind.case) {
		case 'numberValue':
		case 'stringValue':
		case 'boolValue': {
			return value.kind.value
		}
		case 'structValue': {
			const result: Record<string, unknown> = {}
			for (const [key, val] of Object.entries(value.kind.value.fields || {})) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				result[key] = unwrapValue(val as PlainMessage<any>)
			}
			return result
		}
		case 'listValue': {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return value.kind.value.values?.map((value: any) => unwrapValue(value)) || []
		}
		case 'nullValue': {
			return null
		}
		default: {
			return value.kind.value
		}
	}
}

export const parseMetadata = (fields: PlainMessage<Struct>['fields'] = {}) => {
	const json: Metadata = {}

	for (const [k, v] of Object.entries(fields)) {
		if (!isMetadataKey(k)) continue
		const unwrappedValue = unwrapValue(v)

		switch (k) {
			case 'color':
			case 'lineDotColor': {
				json[k] = readColor(unwrappedValue)
				break
			}
			case 'colors': {
				let colorBytes: number[] | Uint8Array | undefined

				// Handle base64-encoded string (from protobuf Struct)
				if (typeof unwrappedValue === 'string') {
					const binary = atob(unwrappedValue)
					colorBytes = new Uint8Array(binary.length)
					for (let i = 0; i < binary.length; i++) {
						colorBytes[i] = binary.charCodeAt(i)
					}
				} else if (Array.isArray(unwrappedValue)) {
					colorBytes = unwrappedValue as number[]
				}

				if (colorBytes && colorBytes.length >= 3) {
					const r = (colorBytes[0] ?? 0) / 255
					const g = (colorBytes[1] ?? 0) / 255
					const b = (colorBytes[2] ?? 0) / 255
					const a = colorBytes.length >= 4 ? (colorBytes[3] ?? 255) / 255 : 1
					json.color = new Color(r, g, b)
					json.opacity = a
				}
				break
			}
			case 'opacity': {
				json[k] = parseOpacity(unwrappedValue)
				break
			}
			case 'gltf': {
				json[k] = unwrappedValue as GLTF
				break
			}
			case 'points': {
				json[k] = unwrappedValue as Vector3[]
				break
			}
			case 'pointSize': {
				json[k] = unwrappedValue as number
				break
			}
			case 'lineWidth': {
				json[k] = unwrappedValue as number
				break
			}
			case 'batched': {
				json[k] = unwrappedValue as { id: number; object: BatchedMesh }
				break
			}
			case 'shape': {
				json[k] = unwrappedValue as ValueOf<typeof SupportedShapes>
				break
			}
		}
	}

	return json
}

const readColor = (color: unknown): Color => {
	if (isColorRepresentation(color)) return parseColor(color)
	if (isRGB(color)) return parseRGB(color)
	return new Color('black')
}
