import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld, type Entity } from 'koota'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import * as useFragmentInfo from '$lib/hooks/useFragmentInfo.svelte'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import { createKeybindings, KEYBINDINGS_CONTEXT_KEY } from '$lib/keybindings'
import { createBoundsObstacleComponent, createObstacleComponent } from '$lib/obstacle'

import DuplicateObstacleButton from '../DuplicateObstacleButton.svelte'

const world = createWorld()

let obstacle: Entity

beforeEach(() => {
	world.reset()
	obstacle = world.spawn(traits.Name('obstacle-1'), traits.Selected)
})

const mountButton = (component = createObstacleComponent('obstacle-1')) => {
	const partConfig = createPartConfigFixture({
		current: { components: [component, createObstacleComponent('obstacle-1-1')] },
	})
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)
	const keybindings = createKeybindings()

	render(DuplicateObstacleButton, {
		props: { component },
		context: new Map<symbol, unknown>([
			[WORLD_CONTEXT_KEY, world],
			[KEYBINDINGS_CONTEXT_KEY, keybindings],
		]),
	})

	return { partConfig, keybindings }
}

describe('DuplicateObstacleButton', () => {
	it('adds a copy of the obstacle under the first free name', async () => {
		const { partConfig } = mountButton()

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate obstacle' }))

		expect(partConfig.createComponent).toHaveBeenCalledTimes(1)
		expect(partConfig.createComponent).toHaveBeenLastCalledWith({
			...createObstacleComponent('obstacle-1'),
			name: 'obstacle-1-2',
		})
	})

	it('copies a Bounds obstacle with its hint', async () => {
		const { partConfig } = mountButton(createBoundsObstacleComponent('obstacle-1'))

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate obstacle' }))

		expect(partConfig.createComponent).toHaveBeenLastCalledWith({
			...createBoundsObstacleComponent('obstacle-1'),
			name: 'obstacle-1-2',
		})
	})

	it('skips a name a fragment already uses', async () => {
		vi.mocked(useFragmentInfo.useFragmentInfo).mockReturnValueOnce({
			current: { 'obstacle-1-2': {} },
		} as unknown as ReturnType<typeof useFragmentInfo.useFragmentInfo>)
		const { partConfig } = mountButton()

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate obstacle' }))

		expect(vi.mocked(partConfig.createComponent).mock.lastCall![0].name).toBe('obstacle-1-3')
	})

	it('duplicates on Shift+D', () => {
		const { partConfig, keybindings } = mountButton()

		const matched = keybindings.matching({ key: 'D', shift: true, mod: false })
		expect(matched.map(({ binding }) => binding.id)).toEqual(['editing.duplicateObstacle'])
		matched[0]?.handler.run()

		expect(partConfig.createComponent).toHaveBeenCalledTimes(1)
	})

	it('selects the copy once its frame appears', async () => {
		mountButton()

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate obstacle' }))
		expect([...world.query(traits.Selected)]).toEqual([obstacle])

		const copy = world.spawn(traits.Name('obstacle-1-2'))

		expect([...world.query(traits.Selected)]).toEqual([copy])
	})
})
