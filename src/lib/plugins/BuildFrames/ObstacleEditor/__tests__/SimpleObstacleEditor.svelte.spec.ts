import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import { createFrame } from '$lib/frame'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import { OBSTACLE_API, OBSTACLE_MODEL, type ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import ObstacleEditor from '../ObstacleEditor.svelte'

const mountEditor = (entry: ObstacleGeometryConfig) => {
	const component = {
		name: 'obstacle-1',
		api: OBSTACLE_API,
		model: OBSTACLE_MODEL,
		frame: createFrame(),
		attributes: { geometries: [entry], extra: 'kept' },
		visualizer: { type: 'simple' },
	}
	const partConfig = createPartConfigFixture({ current: { components: [component] } })
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(partConfig)

	render(ObstacleEditor, { props: { name: 'obstacle-1' } })

	return partConfig
}

const box: ObstacleGeometryConfig = { type: 'box', x: 100, y: 100, z: 100 }

describe('SimpleObstacleEditor', () => {
	it('writes new box dimensions to geometries[0] and keeps the other attributes', async () => {
		const partConfig = mountEditor(box)
		await vi.waitFor(() => expect(document.querySelector('.tp-pndtxtv input')).not.toBeNull())
		const xInput = document.querySelector<HTMLInputElement>('.tp-pndtxtv input')

		await userEvent.tripleClick(xInput!)
		await userEvent.keyboard('55{Tab}')

		await vi.waitFor(() =>
			expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
				attributes: { geometries: [{ type: 'box', x: 55, y: 100, z: 100 }], extra: 'kept' },
			})
		)
		expect(partConfig.updateFrame).not.toHaveBeenCalled()
	})

	it('keeps the label and offset when the shape type changes', async () => {
		const translation = { x: 1, y: 2, z: 3 }
		const orientation = { type: 'ov_degrees' as const, value: { x: 0, y: 0, z: 1, th: 90 } }
		const partConfig = mountEditor({ ...box, label: 'body', translation, orientation })

		await userEvent.click(screen.getByText('Sphere'))

		await vi.waitFor(() =>
			expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
				attributes: {
					geometries: [{ type: 'sphere', r: 100, label: 'body', translation, orientation }],
					extra: 'kept',
				},
			})
		)
		expect(partConfig.updateFrame).not.toHaveBeenCalled()
	})

	it('omits the label and offset keys when the entry had none', async () => {
		const partConfig = mountEditor(box)

		await userEvent.click(screen.getByText('Sphere'))

		await vi.waitFor(() =>
			expect(partConfig.updateComponent).toHaveBeenLastCalledWith('obstacle-1', {
				attributes: { geometries: [{ type: 'sphere', r: 100 }], extra: 'kept' },
			})
		)
	})

	it('does not offer a None shape', () => {
		mountEditor(box)

		expect(screen.queryByText('None')).not.toBeInTheDocument()
		expect(screen.getByText('Box')).toBeInTheDocument()
	})
})
