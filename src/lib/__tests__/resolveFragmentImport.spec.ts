import { describe, expect, it } from 'vitest'

import type { FragmentConfig } from '$lib/resolveFragmentImport'

import { resolveFragmentImport } from '$lib/resolveFragmentImport'

const configs = (entries: Record<string, FragmentConfig>): Map<string, FragmentConfig> =>
	new Map(Object.entries(entries))

const component = (name: string, frame?: unknown) =>
	frame === undefined ? { name } : { name, frame }

describe('resolveFragmentImport variables', () => {
	it('substitutes a variable the import supplies', () => {
		const { config } = resolveFragmentImport(
			{ id: 'arm', variables: { ip: '192.168.1.212' } },
			configs({
				arm: {
					components: [{ name: 'left-arm', attributes: { host: { $variable: { name: 'ip' } } } }],
				},
			})
		)

		expect((config['components'] as { attributes: { host: string } }[])[0].attributes.host).toBe(
			'192.168.1.212'
		)
	})

	it('falls back to the placeholder default when the import supplies nothing', () => {
		const { config } = resolveFragmentImport(
			{ id: 'arm' },
			configs({
				arm: {
					components: [
						{ name: 'a', attributes: { port: { $variable: { name: 'p', default_value: 18333 } } } },
					],
				},
			})
		)

		expect((config['components'] as { attributes: { port: number } }[])[0].attributes.port).toBe(
			18333
		)
	})

	it('reports a variable nothing supplies and leaves the placeholder in place', () => {
		const { config, missingVariables } = resolveFragmentImport(
			{ id: 'arm' },
			configs({
				arm: { components: [{ name: 'a', attributes: { host: { $variable: { name: 'ip' } } } }] },
			})
		)

		expect(missingVariables).toEqual(['ip'])
		expect(
			(config['components'] as { attributes: { host: unknown } }[])[0].attributes.host
		).toEqual({
			$variable: { name: 'ip' },
		})
	})

	it('substitutes a variable inside a frame, not just attributes', () => {
		const { config } = resolveFragmentImport(
			{ id: 'arm', variables: { y: 1003 } },
			configs({
				arm: {
					components: [
						component('left-arm', {
							parent: 'world',
							translation: { x: 0, y: { $variable: { name: 'y' } }, z: 0 },
						}),
					],
				},
			})
		)

		expect(
			(config['components'] as { frame: { translation: { y: number } } }[])[0].frame.translation.y
		).toBe(1003)
	})

	it('passes the parent scope into a nested import and lets the child override it', () => {
		const { config } = resolveFragmentImport(
			{ id: 'root', variables: { shared: 'from-parent', overridden: 'from-parent' } },
			configs({
				root: { fragments: [{ id: 'child', variables: { overridden: 'from-child' } }] },
				child: {
					components: [
						{
							name: 'c',
							attributes: {
								a: { $variable: { name: 'shared' } },
								b: { $variable: { name: 'overridden' } },
							},
						},
					],
				},
			})
		)

		expect(
			(config['components'] as { attributes: { a: string; b: string } }[])[0].attributes
		).toEqual({
			a: 'from-parent',
			b: 'from-child',
		})
	})
})

describe('resolveFragmentImport variable paths', () => {
	it('reports the path a variable supplied, relative to its component', () => {
		const { variablePathsByComponent } = resolveFragmentImport(
			{ id: 'arm', variables: { y: 1003 } },
			configs({
				arm: {
					components: [
						component('left-arm', {
							parent: 'world',
							translation: { y: { $variable: { name: 'y' } } },
						}),
					],
				},
			})
		)

		expect(variablePathsByComponent).toEqual({ 'left-arm': { 'frame.translation.y': 'y' } })
	})

	it('reports a nested fragment path when the machine supplies the variable', () => {
		const { variablePathsByComponent } = resolveFragmentImport(
			{ id: 'root', variables: { y: 1003 } },
			configs({
				root: { fragments: [{ id: 'child' }] },
				child: {
					components: [
						component('left-arm', {
							parent: 'world',
							translation: { y: { $variable: { name: 'y' } } },
						}),
					],
				},
			})
		)

		expect(variablePathsByComponent).toEqual({ 'left-arm': { 'frame.translation.y': 'y' } })
	})

	it('omits a nested fragment path whose variable the parent fragment bound, since the machine cannot set it', () => {
		const { variablePathsByComponent } = resolveFragmentImport(
			{ id: 'root' },
			configs({
				root: { fragments: [{ id: 'child', variables: { y: 1003 } }] },
				child: {
					components: [
						component('left-arm', {
							parent: 'world',
							translation: { y: { $variable: { name: 'y' } } },
						}),
					],
				},
			})
		)

		expect(variablePathsByComponent).toEqual({})
	})

	it('reports no path when nothing in the fragment uses a variable', () => {
		const { variablePathsByComponent } = resolveFragmentImport(
			{ id: 'arm' },
			configs({ arm: { components: [component('left-arm', { parent: 'world' })] } })
		)

		expect(variablePathsByComponent).toEqual({})
	})
})

describe('resolveFragmentImport prefixes', () => {
	it('rewrites a named resource to prefix-name', () => {
		const { config } = resolveFragmentImport(
			{ id: 'arm', prefix: 'left' },
			configs({ arm: { components: [component('arm-1')] } })
		)

		expect((config['components'] as { name: string }[])[0].name).toBe('left-arm-1')
	})

	it('leaves modules unprefixed, since they carry no addressable resource name', () => {
		const { config } = resolveFragmentImport(
			{ id: 'arm', prefix: 'left' },
			configs({ arm: { modules: [{ name: 'viam_ufactory' }] } })
		)

		expect((config['modules'] as { name: string }[])[0].name).toBe('viam_ufactory')
	})

	it('resolves a $this frame parent to the prefixed name', () => {
		const { config } = resolveFragmentImport(
			{ id: 'arm', prefix: 'left' },
			configs({ arm: { components: [component('gripper', { parent: { $this: 'arm-1' } })] } })
		)

		expect((config['components'] as { frame: { parent: string } }[])[0].frame.parent).toBe(
			'left-arm-1'
		)
	})

	it('resolves a $this frame parent to the bare name when no prefix applies', () => {
		const { config } = resolveFragmentImport(
			{ id: 'arm' },
			configs({ arm: { components: [component('gripper', { parent: { $this: 'arm-1' } })] } })
		)

		expect((config['components'] as { frame: { parent: string } }[])[0].frame.parent).toBe('arm-1')
	})

	it('compounds a child prefix beneath the parent prefix', () => {
		const { config } = resolveFragmentImport(
			{ id: 'root', prefix: 'parent' },
			configs({
				root: { fragments: [{ id: 'child', prefix: 'child' }] },
				child: { components: [component('arm-1')] },
			})
		)

		expect((config['components'] as { name: string }[])[0].name).toBe('parent-child-arm-1')
	})

	it('gives a child with no prefix of its own the parent prefix', () => {
		const { config } = resolveFragmentImport(
			{ id: 'root', prefix: 'parent' },
			configs({
				root: { fragments: [{ id: 'child' }] },
				child: { components: [component('arm-1')] },
			})
		)

		expect((config['components'] as { name: string }[])[0].name).toBe('parent-arm-1')
	})
})

describe('resolveFragmentImport nesting', () => {
	it('inlines a nested fragment component', () => {
		const { config } = resolveFragmentImport(
			{ id: 'root' },
			configs({
				root: { fragments: ['child'] },
				child: { components: [component('left-arm')] },
			})
		)

		expect((config['components'] as { name: string }[]).map(({ name }) => name)).toEqual([
			'left-arm',
		])
	})

	it('concatenates a nested fragment components array with the parent, children first', () => {
		const { config } = resolveFragmentImport(
			{ id: 'root' },
			configs({
				root: { fragments: ['child'], components: [component('obstacle-table')] },
				child: { components: [component('left-arm')] },
			})
		)

		expect((config['components'] as { name: string }[]).map(({ name }) => name)).toEqual([
			'left-arm',
			'obstacle-table',
		])
	})

	it('lets the parent win a non-array key', () => {
		const { config } = resolveFragmentImport(
			{ id: 'root' },
			configs({
				root: { fragments: ['child'], agent: { version: 'parent' } },
				child: { agent: { version: 'child' } },
			})
		)

		expect(config['agent']).toEqual({ version: 'parent' })
	})

	it('skips a disabled nested import', () => {
		const { config } = resolveFragmentImport(
			{ id: 'root' },
			configs({
				root: { fragments: [{ id: 'child', disabled: true }] },
				child: { components: [component('left-arm')] },
			})
		)

		expect(config['components']).toBeUndefined()
	})

	it('terminates on a fragment that nests itself', () => {
		const { config } = resolveFragmentImport(
			{ id: 'root' },
			configs({ root: { fragments: ['root'], components: [component('left-arm')] } })
		)

		expect((config['components'] as { name: string }[]).map(({ name }) => name)).toEqual([
			'left-arm',
		])
	})

	it('returns an empty config for a fragment the response never carried', () => {
		expect(resolveFragmentImport({ id: 'missing' }, configs({})).config).toEqual({})
	})

	it('leaves an unresolved placeholder unaliased from the stored config', () => {
		const placeholder = { $variable: { name: 'ip' } }
		const stored: FragmentConfig = {
			components: [{ name: 'arm-1', attributes: { host: placeholder } }],
		}

		const { config } = resolveFragmentImport({ id: 'arm' }, configs({ arm: stored }))

		expect(
			(config['components'] as { attributes: { host: unknown } }[])[0].attributes.host
		).not.toBe(placeholder)
	})

	it('leaves the stored config untouched', () => {
		const stored: FragmentConfig = { components: [component('arm-1')] }

		resolveFragmentImport({ id: 'arm', prefix: 'left' }, configs({ arm: stored }))

		expect((stored['components'] as { name: string }[])[0].name).toBe('arm-1')
	})
})
