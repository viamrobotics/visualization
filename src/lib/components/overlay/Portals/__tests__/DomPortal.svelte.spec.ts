import { render, screen, within } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'

import DomPortalHarness from './__fixtures__/DomPortalHarness.svelte'

vi.mock('#lib/components/overlay/Portals/DomPortal.svelte', (importOriginal) => importOriginal())
vi.mock('#lib/components/overlay/Portals/DomPortalTarget.svelte', (importOriginal) =>
	importOriginal()
)

const target = () => screen.getByRole('region', { name: 'Target' })

describe('DomPortal', () => {
	it('renders its children in the target with the context of where they were declared', () => {
		render(DomPortalHarness, { isTargetShown: true, labels: ['first'] })

		expect(within(target()).getByText('first')).toBeInTheDocument()
	})

	it('takes only its own content out of the target when it unmounts', async () => {
		const { rerender } = render(DomPortalHarness, {
			isTargetShown: true,
			labels: ['first', 'second'],
		})

		await rerender({ isTargetShown: true, labels: ['second'] })

		expect(
			within(target())
				.getAllByText(/./)
				.map((element) => element.textContent)
		).toEqual(["Target's own child", 'second'])
	})

	it('moves its children into a target that remounts', async () => {
		const { rerender } = render(DomPortalHarness, { isTargetShown: true, labels: ['first'] })
		await rerender({ isTargetShown: false, labels: ['first'] })

		await rerender({ isTargetShown: true, labels: ['first'] })

		expect(within(target()).getByText('first')).toBeInTheDocument()
	})
})
