import { render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'

import PartConfigHost from './__fixtures__/PartConfigHost.svelte'

vi.mock('$lib/hooks/usePartConfig.svelte', (importOriginal) => importOriginal())
vi.mock('$lib/hooks/useFragmentInfo.svelte', (importOriginal) => importOriginal())

describe('part config with no ViamAppProvider and no localConfigProps', () => {
	it('settles as an empty, read-only config instead of throwing', () => {
		render(PartConfigHost)

		expect(screen.getByTestId('ready')).toHaveTextContent('true')
		expect(screen.getByTestId('editable')).toHaveTextContent('false')
	})

	it('reports no config source, so Build mode stays out', () => {
		render(PartConfigHost)

		expect(screen.getByTestId('config-source')).toHaveTextContent('false')
	})
})
