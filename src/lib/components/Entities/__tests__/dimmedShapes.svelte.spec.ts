import type { Entity, World } from 'koota'

import { render } from '@testing-library/svelte'
import { BoxGeometry, Color } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { dimColor, traits } from '#lib/ecs/index.js'

import type { DimmedShapesProbe } from './__fixtures__/DimmedShapesHost.svelte'

import DimmedShapesHost from './__fixtures__/DimmedShapesHost.svelte'

vi.mock('@threlte/core/webgpu', (importOriginal) => importOriginal())

const ORIGINAL = { r: 0.8, g: 0.2, b: 0.1 }

const mountScene = async () => {
	let probe: DimmedShapesProbe | undefined
	const result = render(DimmedShapesHost, {
		onready: (ready: DimmedShapesProbe) => {
			probe = ready
		},
	})
	await expect.poll(() => probe).toBeDefined()
	return { ...result, probe: probe as DimmedShapesProbe }
}

const shapeCases: [string, (world: World) => Entity][] = [
	['box', (world) => world.spawn(traits.Box(), traits.WorldMatrix(), traits.Color(ORIGINAL))],
	['sphere', (world) => world.spawn(traits.Sphere(), traits.WorldMatrix(), traits.Color(ORIGINAL))],
	[
		'cylinder',
		(world) => world.spawn(traits.Cylinder(), traits.WorldMatrix(), traits.Color(ORIGINAL)),
	],
	[
		'capsule',
		(world) => world.spawn(traits.Capsule(), traits.WorldMatrix(), traits.Color(ORIGINAL)),
	],
	[
		'buffer-geometry mesh',
		(world) =>
			world.spawn(
				traits.BufferGeometry(new BoxGeometry(1, 1, 1)),
				traits.WorldMatrix(),
				traits.Color(ORIGINAL)
			),
	],
]

describe('dimmed shape renderers', () => {
	it.each(shapeCases)('%s dims on Dimmed and restores on removal', async (_name, spawn) => {
		const { probe } = await mountScene()
		const original = new Color(ORIGINAL.r, ORIGINAL.g, ORIGINAL.b)
		const dimmed = dimColor(original.clone())
		const entity = spawn(probe.world)

		await expect.poll(() => probe.appearanceOf(entity)?.opacity).toBe(1)
		expect(probe.appearanceOf(entity)?.color.getHex()).toBe(original.getHex())

		entity.add(traits.Dimmed)
		await expect.poll(() => probe.appearanceOf(entity)?.opacity).toBe(0.5)
		expect(probe.appearanceOf(entity)?.color.getHex()).toBe(dimmed.getHex())
		expect(dimmed.getHex()).not.toBe(original.getHex())

		entity.remove(traits.Dimmed)
		await expect.poll(() => probe.appearanceOf(entity)?.opacity).toBe(1)
		expect(probe.appearanceOf(entity)?.color.getHex()).toBe(original.getHex())
	})

	it('draws an entity without Dimmed at its own opacity and color', async () => {
		const { probe } = await mountScene()
		const entity = probe.world.spawn(
			traits.Box(),
			traits.WorldMatrix(),
			traits.Color(ORIGINAL),
			traits.Opacity(0.25)
		)

		await expect.poll(() => probe.appearanceOf(entity)?.opacity).toBe(0.25)
		expect(probe.appearanceOf(entity)?.color.getHex()).toBe(
			new Color(ORIGINAL.r, ORIGINAL.g, ORIGINAL.b).getHex()
		)
	})
})
