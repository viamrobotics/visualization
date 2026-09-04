import { render } from '@testing-library/svelte'
import { createWorld } from 'koota'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'
import {
	createDetailsSections,
	DETAILS_SECTIONS_CONTEXT_KEY,
} from '$lib/hooks/useDetailsSections.svelte'

import GizmoDetails from '../GizmoDetails.svelte'

describe('GizmoDetails', () => {
	const world = createWorld()

	beforeEach(() => {
		world.reset()
	})

	const renderWithSections = () => {
		const sections = createDetailsSections()

		render(GizmoDetails, {
			context: new Map([[DETAILS_SECTIONS_CONTEXT_KEY, sections]]),
		})

		return sections
	}

	it('registers exactly one section', () => {
		const sections = renderWithSections()
		expect(sections.current).toHaveLength(1)
	})

	it('applies to an entity with traits.Gizmo', () => {
		const sections = renderWithSections()
		const entity = world.spawn(traits.Gizmo)

		expect(sections.current[0]?.when?.(entity)).toBe(true)
	})

	it('does not apply to an entity without traits.Gizmo', () => {
		const sections = renderWithSections()
		const entity = world.spawn(traits.Name('a plain frame'))

		expect(sections.current[0]?.when?.(entity)).toBe(false)
	})
})
