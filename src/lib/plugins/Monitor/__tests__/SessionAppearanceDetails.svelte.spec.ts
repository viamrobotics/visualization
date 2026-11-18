import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld } from 'koota'
import { Color } from 'three'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import {
	RESOURCE_APPEARANCE_CONTEXT_KEY,
	type ResourceAppearanceContext,
} from '$lib/hooks/useResourceAppearance.svelte'
import { resolvedAppearanceByComponent } from '$lib/resolvedAppearance'

import SessionAppearanceDetails from '../SessionAppearanceDetails.svelte'

const world = createWorld()

beforeEach(() => {
	world.reset()
})

interface MountOptions {
	saved?: Record<string, unknown>
	session?: Record<string, unknown>
	frameId?: string
}

const mountPanel = ({ saved = { type: 'bounds' }, session, frameId }: MountOptions = {}) => {
	const bounds: PartComponent = { name: 'bounds-1', visualizer: saved }
	const partConfig = createPartConfigFixture({ current: { components: [bounds] } })
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)

	const edits = new Map(session ? [['bounds-1', session]] : [])
	const resourceAppearance: ResourceAppearanceContext = {
		current: resolvedAppearanceByComponent([bounds], edits, 'monitor'),
		session: edits,
		setSession: vi.fn(),
	}
	const name = frameId === undefined ? 'bounds-1' : `bounds-1:${frameId}`
	const entity = world.spawn(traits.Name(name), traits.Color(new Color('#888888')))

	render(SessionAppearanceDetails, {
		props: { entity, componentName: 'bounds-1', frameId },
		context: new Map<symbol, unknown>([
			[WORLD_CONTEXT_KEY, world],
			[RESOURCE_APPEARANCE_CONTEXT_KEY, resourceAppearance],
		]),
	})

	return { partConfig, setSession: vi.mocked(resourceAppearance.setSession) }
}

const typeOpacity = async (value: string) => {
	const input = screen.getByLabelText('mutable opacity').querySelector<HTMLInputElement>('input')!
	await userEvent.tripleClick(input)
	await userEvent.keyboard(`${value}{Tab}`)
}

describe('SessionAppearanceDetails', () => {
	it('holds an edit for the session and leaves the config alone', async () => {
		const { partConfig, setSession } = mountPanel()

		await typeOpacity('0.35')

		await vi.waitFor(() =>
			expect(setSession).toHaveBeenLastCalledWith('bounds-1', { opacity: 0.35 })
		)
		expect(partConfig.updateComponent).not.toHaveBeenCalled()
	})

	it('holds a wall edit under its id inside the obstacle', async () => {
		const { setSession } = mountPanel({ frameId: 'floor' })

		await typeOpacity('0.35')

		await vi.waitFor(() =>
			expect(setSession).toHaveBeenLastCalledWith('bounds-1', {
				frames: { floor: { opacity: 0.35 } },
			})
		)
	})

	it('shows the saved value for a key the session leaves unset', () => {
		mountPanel({ saved: { show_axes_helper: false } })

		expect(screen.getByRole('switch', { name: 'show axes helper' })).toHaveAttribute(
			'aria-checked',
			'false'
		)
	})

	it('holds a change from the saved value as an edit', async () => {
		const { setSession } = mountPanel({ saved: { show_axes_helper: false } })

		await userEvent.click(screen.getByRole('switch', { name: 'show axes helper' }))

		expect(setSession).toHaveBeenLastCalledWith('bounds-1', { show_axes_helper: true })
	})

	it('drops an edit set back to the saved value', async () => {
		const { setSession } = mountPanel({
			saved: { show_axes_helper: false },
			session: { show_axes_helper: true },
		})

		await userEvent.click(screen.getByRole('switch', { name: 'show axes helper' }))

		expect(setSession).toHaveBeenLastCalledWith('bounds-1', {})
	})

	it("shows a wall what the obstacle's session edit sets", () => {
		mountPanel({ session: { show_axes_helper: false }, frameId: 'floor' })

		expect(screen.getByRole('switch', { name: 'show axes helper' })).toHaveAttribute(
			'aria-checked',
			'false'
		)
	})

	it('resets the edits at this level and keeps the children', async () => {
		const { setSession } = mountPanel({
			session: { opacity: 0.2, frames: { floor: { opacity: 0.9 } } },
		})

		await userEvent.click(screen.getByRole('button', { name: 'Reset appearance' }))

		expect(setSession).toHaveBeenLastCalledWith('bounds-1', {
			frames: { floor: { opacity: 0.9 } },
		})
	})

	it('resets every child edit and keeps the resource edit', async () => {
		const { setSession } = mountPanel({
			session: { opacity: 0.2, frames: { floor: { opacity: 0.9 } } },
		})

		await userEvent.click(screen.getByRole('button', { name: 'Reset children' }))

		expect(setSession).toHaveBeenLastCalledWith('bounds-1', { opacity: 0.2 })
	})

	it('offers no visible switch, which the world tree already toggles for the session', () => {
		mountPanel()

		expect(screen.queryByRole('switch', { name: 'visible' })).not.toBeInTheDocument()
	})
})
