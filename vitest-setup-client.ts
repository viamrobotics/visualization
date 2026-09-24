import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.mock('@threlte/core', () => ({
	useTask: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
	useThrelte: vi.fn(() => ({
		scene: {
			getObjectByName: vi.fn(() => undefined),
			getObjectByProperty: vi.fn(() => ({
				clone: vi.fn(() => ({ traverse: vi.fn() })),
			})),
		},
		invalidate: vi.fn(),
	})),
	isInstanceOf: vi.fn(() => false),
}))

// @threlte/extras components call into Threlte context that needs a <Canvas> parent,
// which these isolated component tests do not have. Portal must preserve its children
// because the shared DetailsPanel renders its whole UI through it.
vi.mock('@threlte/extras', async () => {
	const MockPortal = await import('$lib/__tests__/__fixtures__/MockPortal.svelte')
	return {
		PortalTarget: vi.fn(),
		Portal: MockPortal.default,
		HTML: vi.fn(),
	}
})

vi.mock('$lib/hooks/useFrames.svelte', () => ({
	useFrames: vi.fn(() => ({ current: [], fetching: false })),
}))
vi.mock('$lib/hooks/useConfigFrames.svelte', () => ({
	useConfigFrames: vi.fn(() => ({
		unsetFrames: [],
		current: {},
	})),
}))
vi.mock('$lib/hooks/useResourceByName.svelte', () => ({
	useResourceByName: vi.fn(() => ({ current: {} })),
}))
vi.mock('$lib/hooks/useFragmentInfo.svelte', () => ({
	useFragmentInfo: vi.fn(() => ({ current: {} })),
}))
vi.mock('$lib/hooks/usePartConfig.svelte', () => ({
	usePartConfig: vi.fn(() => ({
		current: { components: [] },
		set: vi.fn(),
	})),
	LocalPartConfigState: {
		dirty: 'DIRTY',
		clean: 'CLEAN',
		discarded: 'DISCARDED',
		saved: 'SAVED',
	},
}))

vi.mock('$lib/hooks/useLinked.svelte', () => ({
	useLinkedEntities: vi.fn(() => ({ current: [] })),
}))
