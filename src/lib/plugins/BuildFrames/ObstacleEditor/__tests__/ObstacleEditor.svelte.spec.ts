import { render, screen } from '@testing-library/svelte'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { createPartConfigFixture } from '$lib/__tests__/__fixtures__/partConfig'
import * as usePartConfig from '$lib/hooks/usePartConfig.svelte'
import {
	createBoundsObstacleComponent,
	createComplexObstacleComponent,
	createObstacleComponent,
} from '$lib/obstacle'

import ObstacleEditor from '../ObstacleEditor.svelte'

const mountEditor = (component: PartComponent) => {
	vi.mocked(usePartConfig.usePartConfig).mockReturnValue(
		createPartConfigFixture({ current: { components: [component] } })
	)

	render(ObstacleEditor, { props: { name: component.name } })
}

describe('ObstacleEditor', () => {
	it('renders the bounds form for a bounds obstacle', () => {
		mountEditor(createBoundsObstacleComponent('bounds-1'))

		expect(screen.getByLabelText('obstacle bounds')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable interior size')).toBeInTheDocument()
		expect(screen.queryByLabelText('obstacle shape')).not.toBeInTheDocument()
	})

	it('renders the simple editor for a simple obstacle', () => {
		mountEditor(createObstacleComponent('obstacle-1'))

		expect(screen.getByLabelText('obstacle shape')).toBeInTheDocument()
		expect(screen.getByLabelText('mutable box dimensions')).toBeInTheDocument()
	})

	it('routes to the complex editor for a complex obstacle', () => {
		mountEditor(createComplexObstacleComponent('cage'))

		expect(screen.getByLabelText('obstacle geometries')).toBeInTheDocument()
		expect(screen.queryByLabelText('obstacle shape')).not.toBeInTheDocument()
		expect(screen.queryByLabelText('obstacle bounds')).not.toBeInTheDocument()
	})

	it('renders nothing when the component is not in the config', () => {
		vi.mocked(usePartConfig.usePartConfig).mockReturnValue(createPartConfigFixture())

		render(ObstacleEditor, { props: { name: 'missing' } })

		expect(screen.queryByLabelText('obstacle shape')).not.toBeInTheDocument()
	})
})
