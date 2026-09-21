import { describe, expect, it } from 'vitest'

import type { FragmentConfig } from '$lib/resolveFragmentImport'

import { resolveFragmentComponents, withModdedFragmentComponents } from '$lib/fragmentComponents'

const configs = (entries: Record<string, FragmentConfig>): Map<string, FragmentConfig> =>
	new Map(Object.entries(entries))

describe('resolveFragmentComponents', () => {
	it('defaults a frame translation and orientation the fragment omits', () => {
		const components = resolveFragmentComponents(
			[{ id: 'arm' }],
			configs({ arm: { components: [{ name: 'left-arm', frame: { parent: 'world' } }] } })
		)

		expect(components['left-arm'].frame).toEqual({
			parent: 'world',
			translation: { x: 0, y: 0, z: 0 },
			orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
		})
	})

	it('keeps a component with no frame, so it is known but unplaced', () => {
		const components = resolveFragmentComponents(
			[{ id: 'arm' }],
			configs({ arm: { components: [{ name: 'left-arm' }] } })
		)

		expect(components['left-arm']).toEqual({ id: 'arm', variables: {} })
	})

	it('attributes a nested fragment component to the fragment the part imports', () => {
		const components = resolveFragmentComponents(
			[{ id: 'root' }],
			configs({ root: { fragments: ['child'] }, child: { components: [{ name: 'left-arm' }] } })
		)

		expect(components['left-arm'].id).toBe('root')
	})

	it('stringifies the variables the part binds to the import', () => {
		const components = resolveFragmentComponents(
			[{ id: 'arm', variables: { port: 18333 } }],
			configs({ arm: { components: [{ name: 'left-arm' }] } })
		)

		expect(components['left-arm'].variables).toEqual({ port: '18333' })
	})

	it('drops a fragment whose variable nothing supplies, matching the server', () => {
		const components = resolveFragmentComponents(
			[{ id: 'arm' }],
			configs({
				arm: {
					components: [{ name: 'left-arm', attributes: { host: { $variable: { name: 'ip' } } } }],
				},
			})
		)

		expect(components).toEqual({})
	})

	it('skips a disabled import', () => {
		const components = resolveFragmentComponents(
			[{ id: 'arm', disabled: true }],
			configs({ arm: { components: [{ name: 'left-arm' }] } })
		)

		expect(components).toEqual({})
	})

	it('names a prefixed component by its prefixed name', () => {
		const components = resolveFragmentComponents(
			[{ id: 'arm', prefix: 'left' }],
			configs({ arm: { components: [{ name: 'arm-1' }] } })
		)

		expect(Object.keys(components)).toEqual(['left-arm-1'])
	})
})

describe('withModdedFragmentComponents', () => {
	const mods = [
		{ fragment_id: 'arm', mods: [{ $set: { 'components.left-arm.frame.translation.y': 1003 } }] },
	]

	it('adds a component only a mod path names', () => {
		expect(withModdedFragmentComponents({}, mods, {})['left-arm'].id).toBe('arm')
	})

	it('keeps the resolved entry, which is the only one carrying a frame', () => {
		const known = {
			'left-arm': {
				id: 'arm',
				variables: {},
				frame: {
					parent: 'world',
					translation: { x: 20, y: 0, z: 0 },
					orientation: { type: 'ov_degrees' as const, value: { x: 0, y: 0, z: 1, th: 0 } },
				},
			},
		}

		expect(withModdedFragmentComponents(known, mods, {})['left-arm'].frame?.translation.x).toBe(20)
	})

	it('gives an added component the variables the part binds to that fragment', () => {
		expect(
			withModdedFragmentComponents({}, mods, { arm: { ip: '192.168.1.212' } })['left-arm'].variables
		).toEqual({
			ip: '192.168.1.212',
		})
	})

	it('ignores a mod path that names no component', () => {
		const serviceMods = [
			{ fragment_id: 'arm', mods: [{ $set: { 'services.builtin.attributes.x': 1 } }] },
		]

		expect(withModdedFragmentComponents({}, serviceMods, {})).toEqual({})
	})

	it('ignores a mod entry with no fragment id', () => {
		const orphanMods = [{ mods: [{ $set: { 'components.left-arm.frame.translation.y': 1003 } }] }]

		expect(withModdedFragmentComponents({}, orphanMods, {})).toEqual({})
	})
})
