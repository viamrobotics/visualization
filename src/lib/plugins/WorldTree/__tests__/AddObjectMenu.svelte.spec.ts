import { screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { renderWithWorld } from '$lib/__tests__/__fixtures__/renderWithWorld'
import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'

import AddObjectMenu from '../AddObjectMenu.svelte'

describe('AddObjectMenu', () => {
	const renderMenu = (hasEditPermissions: boolean) => {
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue(
			createPartConfigFixture({ hasEditPermissions })
		)

		renderWithWorld(AddObjectMenu, {
			world: createWorld(),
			props: {},
			context: new Map<symbol, unknown>([[ENVIRONMENT_CONTEXT_KEY, createEnvironment()]]),
		})
	}

	it('opens the new obstacle dialog from the menu', async () => {
		renderMenu(true)

		await userEvent.click(screen.getByRole('button', { name: 'Add object' }))
		await userEvent.click(screen.getByRole('menuitem', { name: /Obstacle/ }))

		expect(screen.getByRole('dialog', { name: 'New obstacle' })).toBeInTheDocument()
	})

	it('offers nothing to add when the machine config cannot be edited', async () => {
		renderMenu(false)

		await userEvent.click(screen.getByRole('button', { name: 'Add object' }))

		expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
	})
})
