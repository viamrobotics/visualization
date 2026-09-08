import type { World } from 'koota'

import { render } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { Vector3 } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { traits } from '$lib/ecs'
import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import { createHotkeys, HOTKEYS_CONTEXT_KEY } from '$lib/hooks/useHotkeys.svelte'

import type { usePending } from '../usePending.svelte'

import { GizmoModes } from '../gizmos'
import { spawnPending } from '../spawn'
import * as gizmoTraits from '../traits'
import UsePendingHost from './__fixtures__/UsePendingHost.svelte'

// The global `@threlte/core` mock has no `dom` field, and `useGizmoInputs` (which
// `usePending` wires through) listens for `contextmenu` on it.
vi.mock('@threlte/core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@threlte/core')>()),
	useThrelte: vi.fn(() => ({ dom: document.createElement('div') })),
}))

const renderHost = (
	mode: (typeof GizmoModes)[keyof typeof GizmoModes] = GizmoModes.Polyline,
	handlers: {
		onCancel?: ReturnType<typeof vi.fn<() => void>>
		onConfirm?: ReturnType<typeof vi.fn<() => void>>
		onCommitAndContinue?: ReturnType<typeof vi.fn<() => void>>
		onUndo?: ReturnType<typeof vi.fn<() => void>>
	} = {}
) => {
	let pending: ReturnType<typeof usePending> | undefined
	let world: World | undefined

	const result = render(UsePendingHost, {
		props: {
			mode,
			...handlers,
			onReady: (hook, hookWorld) => {
				pending = hook
				world = hookWorld
			},
		},
		context: new Map<symbol, unknown>([
			[ENVIRONMENT_CONTEXT_KEY, createEnvironment()],
			[HOTKEYS_CONTEXT_KEY, createHotkeys()],
		]),
	})

	if (!pending || !world) throw new Error('usePending never called onReady')

	return { ...result, pending, world }
}

const spawn = (world: World) =>
	spawnPending(world, {
		kind: 'polyline',
		position: new Vector3(),
		traits: [],
	})

describe('usePending', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('has no pending entity until one is set', () => {
		const { pending } = renderHost()

		expect(pending.current).toBeUndefined()
	})

	it('setting then clearing the pending entity updates `current`', () => {
		const { pending, world } = renderHost()

		const entity = spawn(world)
		pending.set(entity)
		expect(pending.current).toBe(entity)

		pending.set(undefined)
		expect(pending.current).toBeUndefined()
	})

	it('destroys an unconfirmed pending entity on unmount', () => {
		const { pending, world, unmount } = renderHost()

		const entity = spawn(world)
		pending.set(entity)

		unmount()

		expect(entity.isAlive()).toBe(false)
	})

	it('does not destroy a pending entity that was confirmed first', () => {
		const { pending, world, unmount } = renderHost()

		const entity = spawn(world)
		pending.set(entity)
		entity.remove(gizmoTraits.PendingGizmo)

		unmount()

		expect(entity.isAlive()).toBe(true)
	})

	it('clears the selection an unconfirmed pending entity held on unmount', () => {
		const { pending, world, unmount } = renderHost()

		const entity = spawn(world)
		entity.add(traits.Selected)
		pending.set(entity)

		unmount()

		expect(entity.has(traits.Selected)).toBe(false)
	})

	it('leaves a confirmed entity selected on unmount', () => {
		const { pending, world, unmount } = renderHost()

		const entity = spawn(world)
		entity.add(traits.Selected)
		pending.set(entity)
		entity.remove(gizmoTraits.PendingGizmo)

		unmount()

		expect(entity.has(traits.Selected)).toBe(true)
	})

	it('runs onConfirm on Enter', async () => {
		const user = userEvent.setup()
		const onConfirm = vi.fn<() => void>()
		renderHost(GizmoModes.Polyline, { onConfirm })

		await user.keyboard('{Enter}')

		expect(onConfirm).toHaveBeenCalledTimes(1)
	})

	it('runs onCancel on Escape', async () => {
		const user = userEvent.setup()
		const onCancel = vi.fn<() => void>()
		renderHost(GizmoModes.Polyline, { onCancel })

		await user.keyboard('{Escape}')

		expect(onCancel).toHaveBeenCalledTimes(1)
	})

	it('runs onCommitAndContinue on Space', async () => {
		const user = userEvent.setup()
		const onCommitAndContinue = vi.fn<() => void>()
		renderHost(GizmoModes.Polyline, { onCommitAndContinue })

		await user.keyboard(' ')

		expect(onCommitAndContinue).toHaveBeenCalledTimes(1)
	})

	it('runs onUndo on Backspace', async () => {
		const user = userEvent.setup()
		const onUndo = vi.fn<() => void>()
		renderHost(GizmoModes.Polyline, { onUndo })

		await user.keyboard('{Backspace}')

		expect(onUndo).toHaveBeenCalledTimes(1)
	})

	it('does not throw when a handler the caller omitted has its key pressed', async () => {
		const user = userEvent.setup()
		renderHost()

		await expect(user.keyboard('{Enter}')).resolves.not.toThrow()
		await expect(user.keyboard(' ')).resolves.not.toThrow()
		await expect(user.keyboard('{Backspace}')).resolves.not.toThrow()
		await expect(user.keyboard('{Escape}')).resolves.not.toThrow()
	})
})
