import { describe, expect, it } from 'vitest'

import { createFrame } from '$lib/frame'

import type { PartConfig } from '../usePartConfig.svelte'

import { patchPartComponent } from '../patchPartComponent'

const createConfig = (): PartConfig => ({
	components: [
		{
			name: 'arm',
			api: 'rdk:component:arm',
			model: 'rdk:builtin:fake',
			attributes: { speed: 1 },
		},
		{
			name: 'box',
			api: 'rdk:component:generic',
			model: 'rdk:builtin:obstacle',
			frame: createFrame(),
			attributes: { geometries: [{ label: 'old', type: 'box', x: 1, y: 1, z: 1 }] },
			visualizer: { type: 'simple', color: '#ff0000' },
		},
	],
})

describe('patchPartComponent', () => {
	it('replaces the named component attributes wholesale and returns true', () => {
		const config = createConfig()

		const patched = patchPartComponent(config, 'box', {
			attributes: { geometries: [{ label: 'shape', type: 'box', x: 1, y: 1, z: 1 }] },
		})

		expect(patched).toBe(true)
		expect(config.components[1].attributes).toEqual({
			geometries: [{ label: 'shape', type: 'box', x: 1, y: 1, z: 1 }],
		})
	})

	it('replaces the visualizer config wholesale', () => {
		const config = createConfig()

		patchPartComponent(config, 'box', { visualizer: { type: 'complex' } })

		expect(config.components[1].visualizer).toEqual({ type: 'complex' })
	})

	it('keeps the fields the patch leaves out, and every other component', () => {
		const config = createConfig()

		patchPartComponent(config, 'box', { attributes: { geometries: [] } })

		expect(config.components[1]).toEqual({
			name: 'box',
			api: 'rdk:component:generic',
			model: 'rdk:builtin:obstacle',
			frame: createFrame(),
			attributes: { geometries: [] },
			visualizer: { type: 'simple', color: '#ff0000' },
		})
		expect(config.components[0]).toEqual(createConfig().components[0])
	})

	it('returns false and does not mutate the config for an unknown name', () => {
		const config = createConfig()

		const patched = patchPartComponent(config, 'missing', { attributes: { geometries: [] } })

		expect(patched).toBe(false)
		expect(config).toEqual(createConfig())
	})

	it('removes a visualizer config left empty', () => {
		const config = createConfig()

		patchPartComponent(config, 'box', { visualizer: {} })

		expect(config.components[1]).not.toHaveProperty('visualizer')
	})

	it('writes a visualizer config onto a component that had none', () => {
		const config: PartConfig = { components: [{ name: 'bare' }] }

		patchPartComponent(config, 'bare', { visualizer: { type: 'simple' } })

		expect(config.components[0].visualizer).toEqual({ type: 'simple' })
	})
})
