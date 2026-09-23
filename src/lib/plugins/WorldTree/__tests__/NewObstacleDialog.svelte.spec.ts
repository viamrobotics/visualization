import { screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { renderWithWorld } from '$lib/__tests__/__fixtures__/renderWithWorld'
import { traits } from '$lib/ecs'
import { createEnvironment, ENVIRONMENT_CONTEXT_KEY } from '$lib/hooks/useEnvironment.svelte'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'

import NewObstacleDialog from '../NewObstacleDialog.svelte'

describe('NewObstacleDialog', () => {
	const world = createWorld()

	beforeEach(() => {
		world.reset()
	})

	const mockPartConfig = (componentNames: string[]) => {
		const createComponent = vi.fn()

		vi.mocked(usePartConfig.usePartConfig).mockReturnValue(
			createPartConfigFixture({
				current: { components: componentNames.map((name) => ({ name })) },
				createComponent,
			})
		)

		return createComponent
	}

	const renderDialog = () => {
		const environment = createEnvironment()
		environment.registerMode('build')

		renderWithWorld(NewObstacleDialog, {
			world,
			props: { open: true },
			context: new Map<symbol, unknown>([[ENVIRONMENT_CONTEXT_KEY, environment]]),
		})

		return environment
	}

	it('seeds the name field with the first free obstacle name', () => {
		mockPartConfig(['obstacle-1'])

		renderDialog()

		expect(screen.getByLabelText('Name')).toHaveValue('obstacle-2')
	})

	it('writes a generic component under the name in the field', async () => {
		const createComponent = mockPartConfig([])
		renderDialog()

		await userEvent.click(screen.getByRole('button', { name: 'Create' }))

		expect(createComponent).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'obstacle-1', api: 'rdk:component:generic' })
		)
	})

	it('creates on Enter in the name field', async () => {
		const createComponent = mockPartConfig([])
		renderDialog()

		await userEvent.type(screen.getByLabelText('Name'), '{Enter}')

		expect(createComponent).toHaveBeenCalledOnce()
	})

	it('switches into build mode, where a config-only frame reaches the scene', async () => {
		mockPartConfig([])
		const environment = renderDialog()

		await userEvent.click(screen.getByRole('button', { name: 'Create' }))

		expect(environment.current.mode).toBe('build')
	})

	it('selects the obstacle once the frame reconciler spawns its row', async () => {
		mockPartConfig([])
		renderDialog()

		await userEvent.click(screen.getByRole('button', { name: 'Create' }))

		expect(world.spawn(traits.Name('obstacle-1')).has(traits.Selected)).toBe(true)
	})

	it('leaves the config alone when the name belongs to another component', async () => {
		const createComponent = mockPartConfig(['barrier'])
		renderDialog()

		const nameField = screen.getByLabelText('Name')
		await userEvent.clear(nameField)
		await userEvent.type(nameField, 'barrier')
		await userEvent.click(screen.getByRole('button', { name: 'Create' }))

		expect(createComponent).not.toHaveBeenCalled()
	})

	it('names the component the taken name collides with', async () => {
		mockPartConfig(['barrier'])
		renderDialog()

		const nameField = screen.getByLabelText('Name')
		await userEvent.clear(nameField)
		await userEvent.type(nameField, 'barrier')

		expect(
			screen.getByText('This machine already has a component named barrier.')
		).toBeInTheDocument()
	})
})
