import { fireEvent, screen, within } from '@testing-library/svelte'

/** A number field by its accessible name, such as a slider's readout. */
export const numberField = (name: string): HTMLInputElement =>
	screen.getByRole<HTMLInputElement>('spinbutton', { name })

/** One axis field, such as `X`, of a named row of number fields. */
export const axisField = (group: string, axis: string): HTMLInputElement =>
	within(screen.getByRole('group', { name: group })).getByRole<HTMLInputElement>('spinbutton', {
		name: axis,
	})

/**
 * Replaces a number field's whole value in one input event, as typing over a selection ends up.
 * One event, not a keystroke each, so a spied write that never feeds the value back can't interleave.
 */
export const enterNumber = async (field: HTMLInputElement, text: string): Promise<void> => {
	await fireEvent.input(field, { target: { value: text } })
}
