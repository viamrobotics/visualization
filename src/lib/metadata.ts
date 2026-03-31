import type { PlainMessage, Struct } from '@viamrobotics/sdk'

import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'

/**
 * Metadata for a Viam `Transform`.
 *
 * Per the API this can be a struct of any data, so we type this version for
 * fields we use and how we expect them to be defined.
 */
export type Metadata = {
	// uniform [r, g, b] or per-vertex [r, g, b, ...] values (0-255)
	colors?: Uint8Array<ArrayBuffer>
	// describes the encoding of the colors field
	colorFormat?: ColorFormat
	// uniform [a] or per-vertex [a, a, ...] values (0-255)
	opacities?: Uint8Array<ArrayBuffer>
}

/** The known wire-format (snake_case) keys that appear in a metadata Struct. */
type MetadataWireKey = 'colors' | 'color_format' | 'opacities'

/** Type guard that checks whether a string is a recognised metadata wire key. */
export const isMetadataKey = (key: string): key is MetadataWireKey => {
	return key === 'colors' || key === 'color_format' || key === 'opacities'
}

/**
 * Extracts typed {@link Metadata} from a proto `Struct` fields map.
 *
 * The `colors` and `opacities` fields are base64-encoded strings (the only way
 * to represent binary data in a `google.protobuf.Value`), which are decoded into
 * `Uint8Array`s.
 *
 * Unknown keys are silently ignored.
 */
export const parseMetadata = (fields: PlainMessage<Struct>['fields'] = {}): Metadata => {
	const json: Metadata = {}

	for (const [k, v] of Object.entries(fields)) {
		if (!isMetadataKey(k)) continue
		const unwrappedValue = unwrapValue(v)

		switch (k) {
			case 'colors': {
				if (typeof unwrappedValue === 'string') {
					const binary = atob(unwrappedValue)
					const colorBytes = new Uint8Array(binary.length)
					for (let i = 0; i < binary.length; i++) {
						colorBytes[i] = binary.charCodeAt(i)
					}
					json.colors = colorBytes
				}
				break
			}

			case 'color_format': {
				if (typeof unwrappedValue === 'number') {
					json.colorFormat = unwrappedValue as ColorFormat
				}
				break
			}

			case 'opacities': {
				if (typeof unwrappedValue === 'string') {
					const binary = atob(unwrappedValue)
					const opacityBytes = new Uint8Array(binary.length)
					for (let i = 0; i < binary.length; i++) {
						opacityBytes[i] = binary.charCodeAt(i)
					}
					json.opacities = opacityBytes
				}
				break
			}
		}
	}

	return json
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
			return (
				value.kind.value.values?.map(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(v: PlainMessage<any>) => unwrapValue(v)
				) || []
			)
		}
		case 'nullValue': {
			return null
		}
		default: {
			return value.kind.value
		}
	}
}
