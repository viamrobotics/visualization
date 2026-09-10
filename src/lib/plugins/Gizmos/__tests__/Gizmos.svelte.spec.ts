import { fireEvent, render, screen } from '@testing-library/svelte'
import { SvelteMap } from 'svelte/reactivity'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Settings } from '$lib/hooks/useSettings.svelte'

import {
	createDetailsSections,
	DETAILS_SECTIONS_CONTEXT_KEY,
} from '$lib/hooks/useDetailsSections.svelte'
import { createHotkeys, HOTKEYS_CONTEXT_KEY } from '$lib/hooks/useHotkeys.svelte'
import { useSettings } from '$lib/hooks/useSettings.svelte'

import Gizmos from '../Gizmos.svelte'

// The scene-side children need a Threlte context and the ECS world, and the global
// `@threlte/core` mock does not export `T`, so importing them for real fails to resolve.
// This spec only exercises the plugin shell, so stand each one in with a component that
// renders nothing. Their own specs cover what they draw.
// Repeated rather than factored into a loop or a shared const: `vi.mock` is hoisted to the
// top of the module, so neither a loop variable nor a shared reference exists when it runs.
vi.mock('../tools/CoordinateSystemTool.svelte', async () => {
	const mock = await import(
		'$lib/plugins/MoveFrame/__tests__/__fixtures__/MockSceneComponent.svelte'
	)
	return { default: mock.default }
})
vi.mock('../tools/GeometryTool.svelte', async () => {
	const mock = await import(
		'$lib/plugins/MoveFrame/__tests__/__fixtures__/MockSceneComponent.svelte'
	)
	return { default: mock.default }
})
vi.mock('../tools/PlaneTool.svelte', async () => {
	const mock = await import(
		'$lib/plugins/MoveFrame/__tests__/__fixtures__/MockSceneComponent.svelte'
	)
	return { default: mock.default }
})
vi.mock('../tools/ArrowTool.svelte', async () => {
	const mock = await import(
		'$lib/plugins/MoveFrame/__tests__/__fixtures__/MockSceneComponent.svelte'
	)
	return { default: mock.default }
})
vi.mock('../tools/LineTool.svelte', async () => {
	const mock = await import(
		'$lib/plugins/MoveFrame/__tests__/__fixtures__/MockSceneComponent.svelte'
	)
	return { default: mock.default }
})
vi.mock('../tools/AngleTool.svelte', async () => {
	const mock = await import(
		'$lib/plugins/MoveFrame/__tests__/__fixtures__/MockSceneComponent.svelte'
	)
	return { default: mock.default }
})
vi.mock('../GizmoEntities.svelte', async () => {
	const mock = await import(
		'$lib/plugins/MoveFrame/__tests__/__fixtures__/MockSceneComponent.svelte'
	)
	return { default: mock.default }
})

// Backed by a real reactive primitive (not a plain object) so the effect that watches
// `interactionMode` for an external takeover actually reruns, the same way it does against
// the real `useSettings` context.
vi.mock('$lib/hooks/useSettings.svelte', () => {
	const state = new SvelteMap<'interactionMode', Settings['interactionMode']>([
		['interactionMode', 'navigate'],
	])

	return {
		useSettings: () => ({
			get current() {
				return {
					get interactionMode() {
						return state.get('interactionMode') ?? 'navigate'
					},
					set interactionMode(value: Settings['interactionMode']) {
						state.set('interactionMode', value)
					},
				}
			},
		}),
	}
})

const renderGizmos = () => {
	const sections = createDetailsSections()
	const hotkeys = createHotkeys()

	const { unmount } = render(Gizmos, {
		context: new Map<symbol, unknown>([
			[DETAILS_SECTIONS_CONTEXT_KEY, sections],
			[HOTKEYS_CONTEXT_KEY, hotkeys],
		]),
	})

	return { hotkeys, unmount }
}

const armCoordinateSystemTool = async () => {
	await fireEvent.click(screen.getByRole('radio', { name: 'Gizmo tools' }))
	await fireEvent.click(await screen.findByRole('button', { name: 'Coordinate system' }))
}

describe('Gizmos', () => {
	beforeEach(() => {
		useSettings().current.interactionMode = 'navigate'
	})

	it('puts the tool picker on the dashboard', () => {
		renderGizmos()

		expect(screen.getByRole('radio', { name: 'Gizmo tools' })).toBeInTheDocument()
	})

	it('offers no exit control until a tool is armed', () => {
		renderGizmos()

		expect(screen.queryByRole('radio', { name: /^Exit/ })).not.toBeInTheDocument()
	})

	it('claims the pointer when a tool is armed from the picker', async () => {
		renderGizmos()

		await armCoordinateSystemTool()

		expect(useSettings().current.interactionMode).toBe('gizmo')
	})

	it('hands the pointer back to navigation from the exit control', async () => {
		renderGizmos()
		await armCoordinateSystemTool()

		await fireEvent.click(await screen.findByRole('radio', { name: 'Exit coordinate-system' }))

		expect(useSettings().current.interactionMode).toBe('navigate')
	})

	it('disarms the tool when another plugin takes interactionMode away', async () => {
		renderGizmos()
		await armCoordinateSystemTool()
		expect(await screen.findByRole('radio', { name: /^Exit/ })).toBeInTheDocument()

		useSettings().current.interactionMode = 'measure'

		await vi.waitFor(() => {
			expect(screen.queryByRole('radio', { name: /^Exit/ })).not.toBeInTheDocument()
		})
	})

	it('arms the reference-geometry tool from the = binding inherited from StaticGeometries', async () => {
		const { hotkeys } = renderGizmos()

		const binding = [...(hotkeys.bindings.get('=') ?? [])][0]
		binding?.run()

		expect(
			await screen.findByRole('radio', { name: 'Exit reference-geometry' })
		).toBeInTheDocument()
	})

	it('hands the pointer back to navigation when unmounted while a tool is armed', async () => {
		const { unmount } = renderGizmos()
		await armCoordinateSystemTool()

		unmount()

		expect(useSettings().current.interactionMode).toBe('navigate')
	})
})
