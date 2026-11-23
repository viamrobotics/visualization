import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import SaveFailureHost from './__fixtures__/SaveFailureHost.svelte'

vi.mock('#lib/hooks/usePartConfig.svelte.js', (importOriginal) => importOriginal())
vi.mock('#lib/hooks/useFragmentInfo.svelte.js', (importOriginal) => importOriginal())

vi.mock('@viamrobotics/svelte-sdk', () => ({
	useViamClient: () => ({}),
	createAppQuery: () => ({
		data: undefined,
		error: undefined,
		isFetching: false,
	}),
	createAppMutation: () => ({ mutateAsync: vi.fn() }),
}))

describe('saving a part config that cannot be written', () => {
	it('shows the user why the save failed', async () => {
		render(SaveFailureHost, { notifier: 'toast' })

		await userEvent.click(screen.getByRole('button', { name: 'Save' }))

		expect(await screen.findByText(/Couldn't save the config/)).toBeInTheDocument()
		expect(screen.getByText(/The machine config has not loaded yet\./)).toBeInTheDocument()
		expect(screen.getByTestId('saved')).toHaveTextContent('false')
	})

	it('resolves false and throws nothing when no notifier is provided', async () => {
		render(SaveFailureHost, { notifier: 'none' })

		await userEvent.click(screen.getByRole('button', { name: 'Save' }))

		expect(await screen.findByText('false')).toBeVisible()
	})
})
