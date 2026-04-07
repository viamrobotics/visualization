import { describe, expect, it } from 'vitest'

import { isMetadataKey, parseMetadata } from '../metadata'

describe('isMetadataKey', () => {
	it('returns true for "colors"', () => {
		expect(isMetadataKey('colors')).toBe(true)
	})

	it('returns true for "show_axes_helper"', () => {
		expect(isMetadataKey('show_axes_helper')).toBe(true)
	})

	it('returns false for unknown keys', () => {
		expect(isMetadataKey('label')).toBe(false)
		expect(isMetadataKey('opacity')).toBe(false)
		expect(isMetadataKey('')).toBe(false)
	})
})

describe('parseMetadata', () => {
	it('returns empty metadata when fields are empty', () => {
		expect(parseMetadata({})).toStrictEqual({})
	})

	it('returns empty metadata when called with no arguments', () => {
		expect(parseMetadata()).toStrictEqual({})
	})

	it('parses colors from a base64-encoded string value', () => {
		const rgba = new Uint8Array([255, 0, 128, 200])
		const base64 = btoa(String.fromCharCode(...rgba))
		const fields = {
			colors: { kind: { case: 'stringValue' as const, value: base64 } },
		}

		const result = parseMetadata(fields)

		expect(result.colors).toBeInstanceOf(Uint8Array)
		expect(result.colors).toStrictEqual(rgba)
	})

	it('ignores unknown keys', () => {
		const fields = {
			unknown: { kind: { case: 'stringValue' as const, value: 'hello' } },
			alsoUnknown: { kind: { case: 'numberValue' as const, value: 42 } },
		}

		expect(parseMetadata(fields)).toStrictEqual({})
	})

	it('handles mixed known and unknown keys', () => {
		const rgba = new Uint8Array([0, 255, 0, 255])
		const base64 = btoa(String.fromCharCode(...rgba))
		const fields = {
			colors: { kind: { case: 'stringValue' as const, value: base64 } },
			label: { kind: { case: 'stringValue' as const, value: 'arm' } },
		}

		const result = parseMetadata(fields)

		expect(result.colors).toStrictEqual(rgba)
		expect(result).not.toHaveProperty('label')
	})

	it('parses show_axes_helper as a boolean', () => {
		const fields = {
			show_axes_helper: { kind: { case: 'boolValue' as const, value: true } },
		}

		const result = parseMetadata(fields)

		expect(result.showAxesHelper).toBe(true)
	})

	it('parses show_axes_helper false', () => {
		const fields = {
			show_axes_helper: { kind: { case: 'boolValue' as const, value: false } },
		}

		const result = parseMetadata(fields)

		expect(result.showAxesHelper).toBe(false)
	})

	it('ignores show_axes_helper when value is not a boolean', () => {
		const fields = {
			show_axes_helper: { kind: { case: 'stringValue' as const, value: 'yes' } },
		}

		expect(parseMetadata(fields)).not.toHaveProperty('showAxesHelper')
	})

	it('handles per-vertex color data through base64 round-trip', () => {
		const perVertex = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255])
		const base64 = btoa(String.fromCharCode(...perVertex))
		const fields = {
			colors: { kind: { case: 'stringValue' as const, value: base64 } },
		}

		const result = parseMetadata(fields)

		expect(result.colors).toStrictEqual(perVertex)
		expect(result.colors!.length).toBe(9)
	})
})
