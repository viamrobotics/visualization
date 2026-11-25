import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { get, set } from 'idb-keyval'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsHost from './__fixtures__/SettingsHost.svelte'

vi.mock('idb-keyval', () => ({
	get: vi.fn(() => Promise.resolve(undefined)),
	set: vi.fn(() => Promise.resolve()),
}))

vi.mock('#lib/hooks/useSettings.svelte.js', (importOriginal) => importOriginal())

beforeEach(() => {
	vi.mocked(get).mockClear()
	vi.mocked(set).mockClear()
})

describe('settings persistence', () => {
	it('writes a changed setting under the storage key prefix', async () => {
		render(SettingsHost, { storageKey: 'widget' })
		await waitFor(() => expect(screen.getByTestId('loaded')).toHaveTextContent('true'))

		await userEvent.click(screen.getByRole('button', { name: 'Toggle' }))

		await waitFor(() => {
			const written = vi.mocked(set).mock.calls.at(-1)
			expect(written?.[0]).toBe('widget:settings')
			expect(written?.[1]).toMatchObject({ enableDollyToCursor: expect.any(Boolean) })
		})
	})

	it('reads and writes no key outside its storage key prefix', async () => {
		render(SettingsHost, { storageKey: 'widget' })
		await waitFor(() => expect(screen.getByTestId('loaded')).toHaveTextContent('true'))

		await userEvent.click(screen.getByRole('button', { name: 'Toggle' }))

		await waitFor(() => expect(set).toHaveBeenCalled())
		const keys = [...vi.mocked(get).mock.calls, ...vi.mocked(set).mock.calls].map(([key]) => key)
		expect(new Set(keys)).toEqual(new Set(['widget:settings']))
	})

	it('touches no storage and is loaded at once without a storage key', async () => {
		render(SettingsHost, { storageKey: undefined })

		expect(screen.getByTestId('loaded')).toHaveTextContent('true')

		await userEvent.click(screen.getByRole('button', { name: 'Toggle' }))

		expect(get).not.toHaveBeenCalled()
		expect(set).not.toHaveBeenCalled()
	})
})
