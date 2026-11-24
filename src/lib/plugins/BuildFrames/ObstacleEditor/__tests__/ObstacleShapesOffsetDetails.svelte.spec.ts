import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '#lib/__tests__/__fixtures__/partConfig.js'
import { orientationEuler } from '#lib/components/overlay/details/sharedPose.js'
import * as usePartConfig from '#lib/hooks/usePartConfig.svelte.js'
import { Pose } from '#lib/math/index.js'
import { createObstacleComponent } from '#lib/obstacle.js'
import { type ObstacleGeometryConfig } from '#lib/obstacleAttributes.js'

import ObstacleShapesOffsetDetails from '../ObstacleShapesOffsetDetails.svelte'

const world = createWorld()

const mountDetails = (geometries: ObstacleGeometryConfig[]) => {
	const component = createObstacleComponent('obstacle-1')
	component.attributes = { geometries }
	component.visualizer = { type: 'complex' }
	const partConfig = createPartConfigFixture({ current: { components: [component] } })
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)

	render(ObstacleShapesOffsetDetails, {
		props: {
			shapes: geometries.map((_geometry, index) => ({ entity: world.spawn(), component, index })),
		},
	})

	return partConfig
}

const fieldInputs = async (label: string, count: number) => {
	const inputs = () => [
		...screen.getByLabelText(label).querySelectorAll<HTMLInputElement>('.tp-pndtxtv input'),
	]
	await vi.waitFor(() => expect(inputs()).toHaveLength(count))
	return inputs()
}

const writtenGeometries = (partConfig: ReturnType<typeof createPartConfigFixture>) =>
	vi.mocked(partConfig.updateComponents).mock.lastCall?.[0].get('obstacle-1')?.attributes
		?.geometries as ObstacleGeometryConfig[] | undefined

describe('ObstacleShapesOffsetDetails', () => {
	it('writes only the typed axis, keeping each shape its own other axes', async () => {
		const partConfig = mountDetails([
			{ label: 'a', type: 'box', x: 1, y: 1, z: 1, translation: { x: 1, y: 2, z: 3 } },
			{ label: 'b', type: 'box', x: 1, y: 1, z: 1, translation: { x: 4, y: 5, z: 6 } },
		])
		const [x] = await fieldInputs('mutable local position', 3)

		await userEvent.tripleClick(x!)
		await userEvent.keyboard('100{Tab}')

		await vi.waitFor(() =>
			expect(writtenGeometries(partConfig)?.map(({ translation }) => translation)).toEqual([
				{ x: 100, y: 2, z: 3 },
				{ x: 100, y: 5, z: 6 },
			])
		)
	})

	it('rebuilds each orientation from its own angles on an Euler edit', async () => {
		const partConfig = mountDetails([
			{
				label: 'a',
				type: 'box',
				x: 1,
				y: 1,
				z: 1,
				orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 90 } },
			},
			{
				label: 'b',
				type: 'box',
				x: 1,
				y: 1,
				z: 1,
				orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 45 } },
			},
		])
		await fieldInputs('mutable local orientation', 7)
		await userEvent.click(screen.getByRole('button', { name: 'Euler' }))
		const orientationInputs = await fieldInputs('mutable local orientation', 7)
		const eulerX = orientationInputs[4]

		await userEvent.tripleClick(eulerX!)
		await userEvent.keyboard('10{Tab}')

		await vi.waitFor(() => expect(writtenGeometries(partConfig)).toHaveLength(2))
		const angles = writtenGeometries(partConfig)?.map((geometry) =>
			orientationEuler(new Pose().setFromFrame(geometry))
		)
		expect(angles?.[0]?.x).toBeCloseTo(10, 3)
		expect(angles?.[0]?.z, 'shape a keeps its own z angle').toBeCloseTo(90, 3)
		expect(angles?.[1]?.x).toBeCloseTo(10, 3)
		expect(angles?.[1]?.z, 'shape b keeps its own z angle').toBeCloseTo(45, 3)
	})
})
