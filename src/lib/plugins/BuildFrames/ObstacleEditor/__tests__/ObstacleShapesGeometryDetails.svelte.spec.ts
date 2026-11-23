import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '#lib/__tests__/__fixtures__/partConfig.js'
import * as usePartConfig from '#lib/hooks/usePartConfig.svelte.js'
import { createObstacleComponent } from '#lib/obstacle.js'
import { type ObstacleGeometryConfig } from '#lib/obstacleAttributes.js'

import ObstacleShapesGeometryDetails from '../ObstacleShapesGeometryDetails.svelte'

const world = createWorld()

const mountDetails = (geometries: ObstacleGeometryConfig[]) => {
	const component = createObstacleComponent('obstacle-1')
	component.attributes = { geometries }
	component.visualizer = { type: 'complex' }
	const partConfig = createPartConfigFixture({ current: { components: [component] } })
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)

	render(ObstacleShapesGeometryDetails, {
		props: {
			shapes: geometries.map((_geometry, index) => ({ entity: world.spawn(), component, index })),
		},
	})

	return partConfig
}

const boxDimensionInputs = async () => {
	const inputs = () => [
		...screen
			.getByLabelText('mutable geometry')
			.querySelectorAll<HTMLInputElement>('.tp-pndtxtv input'),
	]
	await vi.waitFor(() => expect(inputs()).toHaveLength(3))
	return inputs()
}

describe('ObstacleShapesGeometryDetails', () => {
	it('writes only the edited dimension, keeping each box its own other dimensions', async () => {
		const partConfig = mountDetails([
			{ label: 'a', type: 'box', x: 10, y: 20, z: 30 },
			{ label: 'b', type: 'box', x: 40, y: 20, z: 60 },
		])
		const [, y] = await boxDimensionInputs()

		await userEvent.tripleClick(y!)
		await userEvent.keyboard('55{Tab}')

		await vi.waitFor(() =>
			expect(
				vi.mocked(partConfig.updateComponents).mock.lastCall?.[0].get('obstacle-1')?.attributes
					?.geometries
			).toEqual([
				{ label: 'a', type: 'box', x: 10, y: 55, z: 30 },
				{ label: 'b', type: 'box', x: 40, y: 55, z: 60 },
			])
		)
	})

	it('names a shared type it cannot edit instead of offering fields that drop edits', () => {
		mountDetails([
			{ label: 'a', type: 'mesh' } as unknown as ObstacleGeometryConfig,
			{ label: 'b', type: 'mesh' } as unknown as ObstacleGeometryConfig,
		])

		expect(
			screen.getByText("The selected shapes have a geometry type that can't be edited here.")
		).toBeInTheDocument()
		expect(screen.queryByLabelText('mutable geometry')).not.toBeInTheDocument()
	})

	it('names a mix of geometry types instead of offering fields', () => {
		mountDetails([
			{ label: 'a', type: 'box', x: 10, y: 20, z: 30 },
			{ label: 'b', type: 'sphere', r: 4 },
		])

		expect(
			screen.getByText('The selected shapes have different geometry types.')
		).toBeInTheDocument()
		expect(screen.queryByLabelText('mutable geometry')).not.toBeInTheDocument()
	})
})
