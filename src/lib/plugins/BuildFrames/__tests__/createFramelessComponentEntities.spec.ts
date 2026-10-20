import { createWorld, type Entity, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

import { createFramelessComponentEntitiesHarness } from './__fixtures__/framelessComponentEntitiesHarness.svelte'

describe('createFramelessComponentEntities', () => {
	let world: World
	let disposeRoot: (() => void) | undefined

	afterEach(() => {
		disposeRoot?.()
		disposeRoot = undefined
		world?.destroy()
	})

	const mount = (names: string[], active = true) => {
		world = createWorld()

		const harness = createFramelessComponentEntitiesHarness(world, names, active)
		disposeRoot = harness.disposeRoot

		return harness
	}

	const rows = (): Entity[] => [...world.query(traits.Name, traits.FramelessComponent)]

	const rowNames = (): string[] => rows().map((entity) => entity.get(traits.Name) ?? '')

	it('spawns a named row per component', () => {
		mount(['arm-1', 'base-1'])

		expect(rowNames().toSorted()).toEqual(['arm-1', 'base-1'])
	})

	it('spawns nothing while inactive', () => {
		mount(['arm-1'], false)

		expect(rowNames()).toEqual([])
	})

	it('keeps the entity of a name that survives a list change', () => {
		const harness = mount(['arm-1'])
		const [armRow] = rows()

		harness.setNames(['arm-1', 'base-1'])

		expect(rows()).toContain(armRow)
	})

	it('destroys the row of a component that gained a frame', () => {
		const harness = mount(['arm-1', 'base-1'])

		harness.setNames(['base-1'])

		expect(rowNames()).toEqual(['base-1'])
	})

	it('hands a selected row over to the frame that already replaced it', () => {
		const harness = mount(['arm-1'])
		rows()[0].add(traits.Selected)
		const frame = world.spawn(traits.Name('arm-1'), traits.FramesAPI)

		harness.setNames([])

		expect([...world.query(traits.Selected)]).toEqual([frame])
	})

	it('hands a selected row over to a frame that arrives later', () => {
		const harness = mount(['arm-1'])
		rows()[0].add(traits.Selected)

		harness.setNames([])
		const frame = world.spawn(traits.Name('arm-1'), traits.FramesAPI)

		expect([...world.query(traits.Selected)]).toEqual([frame])
	})

	it('leaves the selection alone when the row that went away was not selected', () => {
		const harness = mount(['arm-1'])

		harness.setNames([])
		world.spawn(traits.Name('arm-1'), traits.FramesAPI)

		expect([...world.query(traits.Selected)]).toEqual([])
	})

	it('stops waiting for a frame once the component is back on the list', () => {
		const harness = mount(['arm-1'])
		rows()[0].add(traits.Selected)
		harness.setNames([])

		harness.setNames(['arm-1'])
		world.spawn(traits.Name('arm-1'), traits.FramesAPI)

		expect([...world.query(traits.Selected)]).toEqual([])
	})

	it('destroys every row when it goes inactive', () => {
		const harness = mount(['arm-1', 'base-1'])

		harness.setActive(false)

		expect(rowNames()).toEqual([])
	})

	it('respawns the rows when it goes active again', () => {
		const harness = mount(['arm-1'])
		harness.setActive(false)

		harness.setActive(true)

		expect(rowNames()).toEqual(['arm-1'])
	})

	it('destroys every row on teardown', () => {
		const harness = mount(['arm-1', 'base-1'])

		harness.destroy()

		expect(rowNames()).toEqual([])
	})
})
