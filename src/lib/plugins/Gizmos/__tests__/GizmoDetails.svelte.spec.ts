import { render } from '@testing-library/svelte'
import { createWorld, type Entity } from 'koota'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'
import {
	createDetailsSections,
	DETAILS_SECTIONS_CONTEXT_KEY,
} from '$lib/hooks/useDetailsSections.svelte'

import GizmoDetails from '../GizmoDetails.svelte'
import { ReferencePlane } from '../traits'

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

	// The pose section applies to any gizmo, so it is the only one that
	// applies to a bare gizmo entity with no plane or geometry trait.
	const findPoseSection = (sections: ReturnType<typeof renderWithSections>, bareGizmo: Entity) =>
		sections.current.find((section) => section.when?.(bareGizmo))

	it('registers exactly three sections', () => {
		const sections = renderWithSections()
		expect(sections.current).toHaveLength(3)
	})

	it('applies the pose section to an entity with traits.Gizmo', () => {
		const sections = renderWithSections()
		const bareGizmo = world.spawn(traits.Gizmo)

		expect(findPoseSection(sections, bareGizmo)).toBeDefined()
	})

	it('does not apply the pose section to an entity without traits.Gizmo', () => {
		const sections = renderWithSections()
		const bareGizmo = world.spawn(traits.Gizmo)
		const poseSection = findPoseSection(sections, bareGizmo)
		const nonGizmo = world.spawn(traits.Name('a plain frame'))

		expect(poseSection?.when?.(nonGizmo)).toBe(false)
	})

	it('applies the plane dimensions section to a ReferencePlane entity, and not the geometry dimensions section', () => {
		const sections = renderWithSections()
		const bareGizmo = world.spawn(traits.Gizmo)
		const poseSection = findPoseSection(sections, bareGizmo)
		const planeGizmo = world.spawn(traits.Gizmo, ReferencePlane)
		const otherSections = sections.current.filter((section) => section !== poseSection)
		const applicableSections = otherSections.filter((section) => section.when?.(planeGizmo))

		expect(applicableSections).toHaveLength(1)
	})

	it('does not apply the plane dimensions section to a non-plane gizmo', () => {
		const sections = renderWithSections()
		const bareGizmo = world.spawn(traits.Gizmo)
		const poseSection = findPoseSection(sections, bareGizmo)
		const boxGizmo = world.spawn(traits.Gizmo, traits.Box)
		const planeSection = sections.current.find(
			(section) =>
				section !== poseSection && section.when?.(world.spawn(traits.Gizmo, ReferencePlane))
		)

		expect(planeSection?.when?.(boxGizmo)).toBe(false)
	})

	it.each([
		{ label: 'a box gizmo', spawnEntity: () => world.spawn(traits.Gizmo, traits.Box) },
		{ label: 'a sphere gizmo', spawnEntity: () => world.spawn(traits.Gizmo, traits.Sphere) },
		{ label: 'a capsule gizmo', spawnEntity: () => world.spawn(traits.Gizmo, traits.Capsule) },
	])('applies the geometry dimensions section to $label', ({ spawnEntity }) => {
		const sections = renderWithSections()
		const bareGizmo = world.spawn(traits.Gizmo)
		const poseSection = findPoseSection(sections, bareGizmo)
		const geometryGizmo = spawnEntity()
		const otherSections = sections.current.filter((section) => section !== poseSection)
		const applicableSections = otherSections.filter((section) => section.when?.(geometryGizmo))

		expect(applicableSections).toHaveLength(1)
	})

	it('does not apply the geometry dimensions section to a ReferencePlane gizmo', () => {
		const sections = renderWithSections()
		const bareGizmo = world.spawn(traits.Gizmo)
		const poseSection = findPoseSection(sections, bareGizmo)
		const boxGizmo = world.spawn(traits.Gizmo, traits.Box)
		const dimensionsSection = sections.current.find(
			(section) => section !== poseSection && section.when?.(boxGizmo)
		)
		const planeGizmo = world.spawn(traits.Gizmo, ReferencePlane)

		expect(dimensionsSection?.when?.(planeGizmo)).toBe(false)
	})
})
