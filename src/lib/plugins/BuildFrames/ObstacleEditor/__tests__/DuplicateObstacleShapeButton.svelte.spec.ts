import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld, type Entity } from 'koota'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { relations, traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import { createKeybindings, KEYBINDINGS_CONTEXT_KEY } from '$lib/keybindings'
import { createObstacleComponent } from '$lib/obstacle'
import { type ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import DuplicateObstacleShapeButton from '../DuplicateObstacleShapeButton.svelte'

const twoShapes = (): ObstacleGeometryConfig[] => [
	{ label: 'a', type: 'box', x: 10, y: 20, z: 30 },
	{ label: 'b', type: 'sphere', r: 4 },
]

const world = createWorld()

let obstacle: Entity
let shape: Entity

beforeEach(() => {
	world.reset()
	obstacle = world.spawn(traits.Name('obstacle-1'))
	shape = world.spawn(traits.Name('obstacle-1:a'), traits.Selected, relations.ChildOf(obstacle))
})

const mountButton = (geometries: ObstacleGeometryConfig[] = twoShapes()) => {
	const component = createObstacleComponent('obstacle-1')
	component.attributes = { extra: 'kept', geometries }
	component.visualizer = { type: 'complex' }
	const partConfig = createPartConfigFixture({ current: { components: [component] } })
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)
	const keybindings = createKeybindings()

	render(DuplicateObstacleShapeButton, {
		props: { component, index: 0 },
		context: new Map<symbol, unknown>([
			[WORLD_CONTEXT_KEY, world],
			[KEYBINDINGS_CONTEXT_KEY, keybindings],
		]),
	})

	return { partConfig, keybindings }
}

const expectedWrite = (partConfig: ReturnType<typeof createPartConfigFixture>) => {
	expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
		attributes: {
			extra: 'kept',
			geometries: [...twoShapes(), { label: 'a-1', type: 'box', x: 10, y: 20, z: 30 }],
		},
		visualizer: { type: 'complex' },
	})
}

describe('DuplicateObstacleShapeButton', () => {
	it('appends a copy of the shape to its obstacle', async () => {
		const { partConfig } = mountButton()

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate shape' }))

		expectedWrite(partConfig)
	})

	it('duplicates on Shift+D', () => {
		const { partConfig, keybindings } = mountButton()

		const matched = keybindings.matching({ key: 'D', shift: true, mod: false })
		expect(matched.map(({ binding }) => binding.id)).toEqual(['editing.duplicateObstacleShape'])
		matched[0]?.handler.run()

		expectedWrite(partConfig)
	})

	it('shows the shortcut on the button', () => {
		mountButton()

		expect(screen.getByRole('button', { name: 'Duplicate shape' })).toHaveTextContent('D')
	})

	it('selects the copy once its frame appears', async () => {
		mountButton()

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate shape' }))
		expect([...world.query(traits.Selected)]).toEqual([shape])

		const copy = world.spawn(traits.Name('obstacle-1:a-1'), relations.ChildOf(obstacle))

		expect([...world.query(traits.Selected)]).toEqual([copy])
	})

	it('shows the error and writes nothing for a copy rdk would reject', async () => {
		const { partConfig } = mountButton([{ label: 'a', type: 'sphere', r: 0 }])

		await userEvent.click(screen.getByRole('button', { name: 'Duplicate shape' }))

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'A sphere radius must be greater than zero.'
		)
		expect(partConfig.updateComponent).not.toHaveBeenCalled()
	})
})
