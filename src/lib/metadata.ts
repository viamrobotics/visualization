import type { PlainMessage, Struct } from '@viamrobotics/sdk'

import {
	ColorFormat,
	Metadata as MetadataProto,
	type Relationship as RelationshipProto,
} from '$lib/buf/draw/v1/metadata_pb'

/** Metadata for a `Drawing` or `Transform`. Relationships default to empty. */
export type Metadata = Omit<PlainMessage<MetadataProto>, 'relationships'> & {
	relationships?: PlainMessage<MetadataProto>['relationships']
}

/** Plain-object representation of a Relationship, usable outside proto classes. */
export type Relationship = PlainMessage<RelationshipProto>

/** Type guard that checks whether a string is a recognised metadata wire key. */
export const isMetadataField = (key: string): boolean => {
	return (
		key === 'colors' ||
		key === 'color_format' ||
		key === 'opacities' ||
		key === 'show_axes_helper' ||
		key === 'invisible' ||
		key === 'chunks' ||
		key === 'relationships'
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

			case 'invisible': {
				if (typeof unwrappedValue === 'boolean') {
					json.invisible = unwrappedValue
				}
				break
			}

			case 'chunks': {
				if (typeof unwrappedValue === 'object' && unwrappedValue !== null) {
					const obj = unwrappedValue as Record<string, unknown>
					json.chunks = {
						chunkSize: typeof obj['chunk_size'] === 'number' ? obj['chunk_size'] : 0,
						total: typeof obj['total'] === 'number' ? obj['total'] : 0,
						stride: typeof obj['stride'] === 'number' ? obj['stride'] : 0,
					}
				}
				break
			}

			case 'relationships': {
				if (Array.isArray(unwrappedValue)) {
					json.relationships = unwrappedValue
						.filter(
							(item): item is Record<string, unknown> => typeof item === 'object' && item !== null
						)
						.map((item) => {
							const targetUuidStr = item['target_uuid']
							let targetUuid = new Uint8Array()
							if (typeof targetUuidStr === 'string' && targetUuidStr.length > 0) {
								const binary = atob(targetUuidStr)
								targetUuid = new Uint8Array(binary.length)
								for (let i = 0; i < binary.length; i++) {
									targetUuid[i] = binary.charCodeAt(i)
								}
							}
							return {
								targetUuid,
								type: typeof item['type'] === 'string' ? item['type'] : '',
								indexMapping:
									typeof item['index_mapping'] === 'string' ? item['index_mapping'] : undefined,
							}
						})
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
