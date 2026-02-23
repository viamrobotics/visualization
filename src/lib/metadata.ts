import type { PlainMessage, Struct } from '@viamrobotics/sdk'

/**
 * Metadata for a Viam `Transform`.
 *
 * Per the API this can be a struct of any data, so we type this version for
 * fields we use and how we expect them to be defined.
 */
export type Metadata = {
	// format [r, g, b, a, ...]
	colors?: Uint8Array<ArrayBuffer>
}

export const isMetadataKey = (key: string): key is keyof Metadata => {
	return key === 'colors'
}

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
				} else {
					json.colors = unwrappedValue as Uint8Array<ArrayBuffer>
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
		case 'boolValue':
			return value.kind.value
		case 'structValue': {
			const result: Record<string, unknown> = {}
			for (const [key, val] of Object.entries(value.kind.value.fields || {})) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				result[key] = unwrapValue(val as PlainMessage<any>)
			}
			return result
		}
		case 'listValue':
			return value.kind.value.values?.map(unwrapValue) || []
		case 'nullValue':
			return null
		default:
			return value.kind.value
	}
}
