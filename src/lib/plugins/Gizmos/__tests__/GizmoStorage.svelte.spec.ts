import { render } from '@testing-library/svelte'
import { createWorld, type World } from 'koota'
import { tick } from 'svelte'
import { Matrix4 } from 'three'
import { beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

import type { provideGizmoStorage } from '../useGizmoStorage.svelte'

import { GIZMO_STORE_VERSION, type GizmoStore, gizmoStoreKey } from '../gizmoRecord'
import { spawnGizmo } from '../spawn'
import GizmoStorageHarness from './__fixtures__/GizmoStorageHarness.svelte'

const DEBOUNCE_WAIT_MS = 600

const waitForDebounce = () => new Promise((resolve) => setTimeout(resolve, DEBOUNCE_WAIT_MS))

const persistenceKey = (partID: string) => `${partID}:gizmos-persist`

const renderHarness = (world: World, partID: string) => {
	let storage!: ReturnType<typeof provideGizmoStorage>

	render(GizmoStorageHarness, {
		props: {
			world,
			partID,
			onStorage: (value) => {
				storage = value
			},
		},
	})

	return storage
}

describe('GizmoStorage', () => {
	const partID = 'part-1'

	beforeEach(() => {
		localStorage.clear()
	})

	it('does not write to storage while persistence is disabled', async () => {
		const world = createWorld()
		renderHarness(world, partID)

		spawnGizmo(world, {
			kind: 'coordinate-system',
			matrix: new Matrix4(),
			traits: [traits.ReferenceFrame],
		})
		await waitForDebounce()

		expect(localStorage.getItem(gizmoStoreKey(partID))).toBeNull()
	})

	it('writes the placed gizmo to storage once persistence is enabled', async () => {
		const world = createWorld()
		const storage = renderHarness(world, partID)
		storage.enabled = true
		await tick()

		spawnGizmo(world, {
			kind: 'coordinate-system',
			matrix: new Matrix4().makeTranslation(1, 2, 3),
			traits: [traits.ReferenceFrame],
		})
		await waitForDebounce()

		const stored = JSON.parse(localStorage.getItem(gizmoStoreKey(partID)) ?? 'null') as GizmoStore
		expect(stored.version).toBe(GIZMO_STORE_VERSION)
		expect(stored.gizmos).toHaveLength(1)
		expect(stored.gizmos[0]?.kind).toBe('coordinate-system')
		expect(stored.gizmos[0]?.matrix).toEqual(new Matrix4().makeTranslation(1, 2, 3).elements)
	})

	it('restores the stored gizmos into the world on mount when persistence is enabled', async () => {
		localStorage.setItem(persistenceKey(partID), 'true')
		const store: GizmoStore = {
			version: GIZMO_STORE_VERSION,
			gizmos: [
				{
					kind: 'coordinate-system',
					name: 'coordinate-system 1',
					matrix: new Matrix4().makeTranslation(4, 5, 6).elements,
				},
			],
		}
		localStorage.setItem(gizmoStoreKey(partID), JSON.stringify(store))

		const world = createWorld()
		renderHarness(world, partID)
		await tick()

		const restored = [...world.query(traits.Gizmo)]
		expect(restored).toHaveLength(1)
		expect([...restored[0]!.get(traits.Matrix)!.elements]).toEqual(
			new Matrix4().makeTranslation(4, 5, 6).elements
		)
	})

	it('clears the stored payload for the current part when persistence is turned off', async () => {
		const world = createWorld()
		const storage = renderHarness(world, partID)
		storage.enabled = true
		await tick()

		spawnGizmo(world, {
			kind: 'coordinate-system',
			matrix: new Matrix4(),
			traits: [traits.ReferenceFrame],
		})
		await waitForDebounce()
		expect(localStorage.getItem(gizmoStoreKey(partID))).not.toBeNull()

		storage.enabled = false
		await tick()

		expect(localStorage.getItem(gizmoStoreKey(partID))).toBeNull()
	})

	it('does not throw and restores nothing when the stored value is corrupt JSON', async () => {
		localStorage.setItem(persistenceKey(partID), 'true')
		localStorage.setItem(gizmoStoreKey(partID), '{not valid json')

		const world = createWorld()

		expect(() => renderHarness(world, partID)).not.toThrow()
		await tick()

		expect([...world.query(traits.Gizmo)]).toHaveLength(0)
	})
})
