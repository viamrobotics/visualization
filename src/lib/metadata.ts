import type { PlainMessage, Struct } from '@viamrobotics/sdk'

import { ColorFormat, Metadata as MetadataProto } from '$lib/buf/draw/v1/metadata_pb'

/** Metadata for a `Drawing` or `Transform`. */
export type Metadata = PlainMessage<MetadataProto>

/** Type guard that checks whether a string is a recognised metadata wire key. */
export const isMetadataField = (key: string): boolean => {
	return (
		key === 'colors' || key === 'color_format' || key === 'opacities' || key === 'show_axes_helper'
	)
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
export const metadataFromStruct = (fields: PlainMessage<Struct>['fields'] = {}): Metadata => {
	const json: Metadata = {
		colorFormat: ColorFormat.UNSPECIFIED,
	}

	for (const [k, v] of Object.entries(fields)) {
		if (!isMetadataField(k)) continue
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

			case 'show_axes_helper': {
				if (typeof unwrappedValue === 'boolean') {
					json.showAxesHelper = unwrappedValue
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
