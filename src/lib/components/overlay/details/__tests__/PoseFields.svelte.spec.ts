import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import type { Frame } from '$lib/frame'

import PoseFields from '../PoseFields.svelte'

type Pose = Pick<Frame, 'translation' | 'orientation'>

const translation = { x: 10, y: 20, z: 30 }
const orientation: Frame['orientation'] = {
	type: 'ov_degrees',
	value: { x: 0, y: 0, z: 1, th: 90 },
}

const inputValues = (label: string) =>
	[...screen.getByLabelText(label).querySelectorAll<HTMLInputElement>('.tp-pndtxtv input')].map(
		(input) => Number(input.value)
	)

const waitForInputs = (label: string) =>
	vi.waitFor(() => expect(inputValues(label).length).toBeGreaterThan(0))

const editFirstInput = async (label: string, text: string) => {
	await waitForInputs(label)
	const input = screen.getByLabelText(label).querySelector<HTMLInputElement>('.tp-pndtxtv input')
	await userEvent.tripleClick(input!)
	await userEvent.keyboard(`${text}{Tab}`)
}

describe('PoseFields', () => {
	it('displays a translation and an ov_degrees orientation', async () => {
		render(PoseFields, { props: { translation, orientation, onchange: vi.fn() } })
		await waitForInputs('mutable local position')
		await waitForInputs('mutable local orientation')

		expect(inputValues('mutable local position')).toEqual([10, 20, 30])
		expect(inputValues('mutable local orientation')).toEqual([0, 0, 1, 90])
	})

	it('displays a quaternion orientation as its OV equivalent', async () => {
		const half = Math.SQRT1_2
		render(PoseFields, {
			props: {
				translation,
				orientation: { type: 'quaternion', value: { x: 0, y: 0, z: half, w: half } },
				onchange: vi.fn(),
			},
		})
		await waitForInputs('mutable local orientation')

		const [x, y, z, theta] = inputValues('mutable local orientation')
		expect([x, y, z]).toEqual([0, 0, 1])
		expect(theta).toBeCloseTo(90, 1)
	})

	it('emits the new translation with the orientation as ov_degrees on a position edit', async () => {
		const emitted: Pose[] = []
		render(PoseFields, {
			props: {
				translation,
				orientation: { type: 'ov_radians', value: { x: 0, y: 0, z: 1, th: Math.PI } },
				onchange: (next: Pose) => emitted.push(next),
			},
		})

		await editFirstInput('mutable local position', '55')

		await vi.waitFor(() =>
			expect(emitted.at(-1)).toEqual({
				translation: { x: 55, y: 20, z: 30 },
				orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 180 } },
			})
		)
	})

	it('emits ov_degrees with the translation unchanged on an orientation edit', async () => {
		const emitted: Pose[] = []
		render(PoseFields, {
			props: { translation, orientation, onchange: (next: Pose) => emitted.push(next) },
		})

		await editFirstInput('mutable local orientation', '1')

		await vi.waitFor(() =>
			expect(emitted.at(-1)).toEqual({
				translation,
				orientation: { type: 'ov_degrees', value: { x: 1, y: 0, z: 1, th: 90 } },
			})
		)
	})

	it('does not emit when the props change', async () => {
		const onchange = vi.fn()
		const { rerender } = render(PoseFields, {
			props: { translation, orientation, onchange },
		})
		await waitForInputs('mutable local position')

		await rerender({
			translation: { x: 1, y: 2, z: 3 },
			orientation: { type: 'ov_degrees', value: { x: 0, y: 1, z: 0, th: 45 } },
			onchange,
		})
		await rerender({ translation: undefined, orientation: undefined, onchange })

		expect(onchange).not.toHaveBeenCalled()
		await vi.waitFor(() => expect(inputValues('mutable local orientation')).toEqual([0, 0, 1, 0]))
	})
})
