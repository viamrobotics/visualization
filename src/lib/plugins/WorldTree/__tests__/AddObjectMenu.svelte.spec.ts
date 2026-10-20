import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'

import AddObjectMenu from '../AddObjectMenu.svelte'

describe('AddObjectMenu', () => {
	const renderMenu = (hasEditPermissions: boolean) => {
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue(
			createPartConfigFixture({ hasEditPermissions })
		)

		render(AddObjectMenu, {
			context: new Map<symbol, unknown>([
				[WORLD_CONTEXT_KEY, createWorld()],
				[ENVIRONMENT_CONTEXT_KEY, createEnvironment()],
			]),
		})
	}

	it('swaps the menu to the obstacle types when Obstacle is picked', async () => {
		renderMenu(true)

		await userEvent.click(screen.getByRole('button', { name: 'Add object' }))
		await userEvent.click(screen.getByRole('menuitem', { name: /Obstacle/ }))

		expect(screen.getByRole('menu', { name: 'Obstacle' })).toBeInTheDocument()
		expect(screen.getByRole('menuitem', { name: /Simple/ })).toHaveFocus()
		expect(screen.getByRole('menuitem', { name: /Bounds/ })).toBeInTheDocument()
		expect(screen.getByRole('menuitem', { name: /Complex/ })).toBeInTheDocument()
		expect(screen.queryByRole('dialog', { name: /New .* obstacle/ })).not.toBeInTheDocument()
	})

	it('goes back to the object list', async () => {
		renderMenu(true)

		await userEvent.click(screen.getByRole('button', { name: 'Add object' }))
		await userEvent.click(screen.getByRole('menuitem', { name: /Obstacle/ }))
		await userEvent.click(screen.getByRole('menuitem', { name: 'Back' }))

		expect(screen.getByRole('menu', { name: 'Add' })).toBeInTheDocument()
		expect(screen.getByRole('menuitem', { name: /Obstacle/ })).toHaveFocus()
	})

	it.each([
		['Simple', 'New simple obstacle'],
		['Bounds', 'New bounds obstacle'],
		['Complex', 'New complex obstacle'],
	])('opens the dialog for a %s obstacle', async (label, title) => {
		renderMenu(true)

		await userEvent.click(screen.getByRole('button', { name: 'Add object' }))
		await userEvent.click(screen.getByRole('menuitem', { name: /Obstacle/ }))
		await userEvent.click(screen.getByRole('menuitem', { name: new RegExp(label) }))

		expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument()
		expect(screen.queryByRole('menu')).not.toBeInTheDocument()
	})

	it('reopens on the object list', async () => {
		renderMenu(true)

		const trigger = screen.getByRole('button', { name: 'Add object' })
		await userEvent.click(trigger)
		await userEvent.click(screen.getByRole('menuitem', { name: /Obstacle/ }))
		await userEvent.keyboard('{Escape}')
		await userEvent.click(trigger)

		expect(screen.getByRole('menu', { name: 'Add' })).toBeInTheDocument()
	})

	it('offers nothing to add when the machine config cannot be edited', async () => {
		renderMenu(false)

		await userEvent.click(screen.getByRole('button', { name: 'Add object' }))

		expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
	})
})
