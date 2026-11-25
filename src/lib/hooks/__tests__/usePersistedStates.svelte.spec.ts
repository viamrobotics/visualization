import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import PersistedStatesHost from './__fixtures__/PersistedStatesHost.svelte'

describe('usePersistedStates', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('shares one live value per key across lookups in a visualizer without a storage key', async () => {
		render(PersistedStatesHost, { storageKey: undefined })

		await userEvent.click(screen.getByRole('button', { name: 'Pick' }))

		expect(screen.getByTestId('reader')).toHaveTextContent('ov')
	})

	it('shares one live value per key across lookups in a visualizer with a storage key', async () => {
		render(PersistedStatesHost, { storageKey: 'widget' })

		await userEvent.click(screen.getByRole('button', { name: 'Pick' }))

		expect(screen.getByTestId('reader')).toHaveTextContent('ov')
	})

	it('persists under the storage key prefix', async () => {
		render(PersistedStatesHost, { storageKey: 'widget' })

		await userEvent.click(screen.getByRole('button', { name: 'Pick' }))

		expect(localStorage.getItem('widget:orientation-format')).toBe(JSON.stringify('ov'))
	})

	it('writes nothing to storage without a storage key', async () => {
		render(PersistedStatesHost, { storageKey: undefined })

		await userEvent.click(screen.getByRole('button', { name: 'Pick' }))

		expect(localStorage.length).toBe(0)
	})
})
