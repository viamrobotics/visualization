import { screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'

/** One axis field, such as `X`, of a named row of number fields. */
export const axisField = (group: string, axis: string): HTMLElement =>
	within(screen.getByRole('group', { name: group })).getByRole('spinbutton', { name: axis })

/**
 * Replaces a number field's value the way a user retypes it. Pasting, not typing, writes the whole
 * number in one input event, so a spied write that never feeds the value back can't interleave.
 */
export const enterNumber = async (field: HTMLElement, text: string): Promise<void> => {
	await userEvent.clear(field)
	await userEvent.paste(text)
}
