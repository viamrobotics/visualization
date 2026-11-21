import { render } from '@testing-library/svelte'
import { isInstanceOf } from '@threlte/core/webgpu'
import { createWorld, type Entity, type World } from 'koota'
import { tick } from 'svelte'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Dimmed, Name, OpacityOverride } from '#lib/ecs/traits.js'
import { WORLD_CONTEXT_KEY } from '#lib/ecs/useWorld.js'

import GeometryModelHost from './__fixtures__/GeometryModelHost.svelte'

const { mountedProps, stubModels } = vi.hoisted(() => ({
	mountedProps: [] as { is: Object3D; name?: unknown }[],
	stubModels: {} as Record<string, Record<string, Object3D>>,
}))

vi.mock('@threlte/core/webgpu', () => ({
	useTask: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
	useThrelte: vi.fn(() => ({ invalidate: vi.fn() })),
	isInstanceOf: vi.fn(() => false),
	T: vi.fn((anchor: Comment, props: { is: Object3D; name?: unknown; children?: unknown }) => {
		mountedProps.push(props as never)
		;(props.children as ((anchor: Comment) => void) | undefined)?.(anchor)
	}),
}))

vi.mock('#lib/hooks/use3DModels.svelte.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/hooks/use3DModels.svelte.js')>()),
	use3DModels: () => ({ current: stubModels }),
}))

vi.mock('../hooks/useEntityEvents.svelte', () => ({ useEntityEvents: () => ({}) }))

const RED_HEX = 0xff0000

describe('GeometryModel dimming', () => {
	let world: World
	let entity: Entity

	const mountedMaterial = () => {
		const model = mountedProps.find((props) => props.name !== undefined)?.is
		const mesh = model?.children[0] as Mesh | undefined
		if (!mesh) throw new Error('GeometryModel mounted no model')
		return mesh.material as MeshStandardMaterial
	}

	beforeEach(() => {
		vi.mocked(isInstanceOf).mockImplementation(
			(object, type) => (object as Record<string, unknown>)[`is${type}`] === true
		)
		stubModels.xarm = {
			link: new Group().add(
				new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: RED_HEX }))
			),
		}
		world = createWorld()
		entity = world.spawn(Name('xarm:link'))
		mountedProps.length = 0

		render(GeometryModelHost, {
			props: { entity },
			context: new Map([[WORLD_CONTEXT_KEY, world]]),
		})
	})

	afterEach(() => {
		world.destroy()
	})

	it('draws the model in its own colors and opacity before it is dimmed', () => {
		const material = mountedMaterial()

		expect(material.opacity).toBe(1)
		expect(material.color.getHex()).toBe(RED_HEX)
	})

	it('draws a dimmed model at half opacity with its color blended toward gray-5', async () => {
		entity.add(Dimmed)
		await tick()

		const material = mountedMaterial()
		expect(material.opacity).toBe(0.5)
		expect(material.color.r).toBeCloseTo(0.77917, 4)
		expect(material.color.g).toBeCloseTo(0.28236, 4)
		expect(material.color.b).toBeCloseTo(0.30191, 4)
	})

	it('restores the exact original opacity and color when Dimmed is removed', async () => {
		entity.add(Dimmed)
		await tick()
		entity.remove(Dimmed)
		await tick()

		const material = mountedMaterial()
		expect(material.opacity).toBe(1)
		expect(material.color.toArray()).toEqual(
			new MeshStandardMaterial({ color: RED_HEX }).color.toArray()
		)
	})

	it('keeps a dimmed model at half opacity under an override of 1', async () => {
		entity.add(OpacityOverride(1), Dimmed)
		await tick()

		expect(mountedMaterial().opacity).toBe(0.5)
	})
})
