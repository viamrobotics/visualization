import { describe, expect, it } from 'vitest'

import { metadataFromStruct } from '../metadata'

describe('metadataFromStruct', () => {
	it('returns empty metadata when fields are empty', () => {
		expect(metadataFromStruct({})).toStrictEqual({ colorFormat: 0 })
	})

	it('returns empty metadata when called with no arguments', () => {
		expect(metadataFromStruct()).toStrictEqual({ colorFormat: 0 })
	})

	it('parses colors from a base64-encoded string value', () => {
		const rgba = new Uint8Array([255, 0, 128, 200])
		const base64 = btoa(String.fromCharCode(...rgba))
		const fields = {
			colors: { kind: { case: 'stringValue' as const, value: base64 } },
		}

		const result = metadataFromStruct(fields)

		expect(result.colors).toBeInstanceOf(Uint8Array)
		expect(result.colors).toStrictEqual(rgba)
	})

	it('ignores unknown keys', () => {
		const fields = {
			unknown: { kind: { case: 'stringValue' as const, value: 'hello' } },
			alsoUnknown: { kind: { case: 'numberValue' as const, value: 42 } },
		}

		expect(metadataFromStruct(fields)).toStrictEqual({ colorFormat: 0 })
	})

	it('handles mixed known and unknown keys', () => {
		const rgba = new Uint8Array([0, 255, 0, 255])
		const base64 = btoa(String.fromCharCode(...rgba))
		const fields = {
			colors: { kind: { case: 'stringValue' as const, value: base64 } },
			label: { kind: { case: 'stringValue' as const, value: 'arm' } },
		}

		const result = metadataFromStruct(fields)

		expect(result.colors).toStrictEqual(rgba)
		expect(result).not.toHaveProperty('label')
	})

	it('parses show_axes_helper as a boolean', () => {
		const fields = {
			show_axes_helper: { kind: { case: 'boolValue' as const, value: true } },
		}

		const result = metadataFromStruct(fields)

		expect(result.showAxesHelper).toBe(true)
	})

	it('parses show_axes_helper false', () => {
		const fields = {
			show_axes_helper: { kind: { case: 'boolValue' as const, value: false } },
		}

		const result = metadataFromStruct(fields)

		expect(result.showAxesHelper).toBe(false)
	})

	it('ignores show_axes_helper when value is not a boolean', () => {
		const fields = {
			show_axes_helper: { kind: { case: 'stringValue' as const, value: 'yes' } },
		}

		expect(metadataFromStruct(fields)).not.toHaveProperty('showAxesHelper')
	})

	it('handles per-vertex color data through base64 round-trip', () => {
		const perVertex = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255])
		const base64 = btoa(String.fromCharCode(...perVertex))
		const fields = {
			colors: { kind: { case: 'stringValue' as const, value: base64 } },
		}

		const result = metadataFromStruct(fields)

		expect(result.colors).toStrictEqual(perVertex)
		expect(result.colors!.length).toBe(9)
	})
})
