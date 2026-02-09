import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock Threlte context and hooks before any imports
vi.mock('@threlte/core', () => ({
	useTask: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
	useThrelte: vi.fn(() => ({
		scene: {
			getObjectByProperty: vi.fn(() => ({
				clone: vi.fn(() => ({ traverse: vi.fn() })),
			})),
		},
	})),
	isInstanceOf: vi.fn(() => false),
}))

// Mock selection hooks
vi.mock('$lib/hooks/useSelection.svelte', () => ({
	useFocused: vi.fn(() => ({ current: undefined, set: vi.fn() })),
	useFocusedEntity: vi.fn(() => ({ current: undefined })),
	useFocusedObject3d: vi.fn(() => ({ current: undefined })),
	useSelectedEntity: vi.fn(() => ({ current: undefined })),
	useSelectedObject3d: vi.fn(() => ({ current: undefined })),
}))

// Mock useFrames hook
vi.mock('$lib/hooks/useFrames.svelte', () => ({
	useFrames: vi.fn(() => ({ current: [], fetching: false, getParentFrameOptions: vi.fn() })),
}))
vi.mock('$lib/hooks/useResourceByName.svelte', () => ({
	useResourceByName: vi.fn(() => ({ current: {} })),
}))
// Mock usePartConfig hook
vi.mock('$lib/hooks/usePartConfig.svelte', () => ({
	usePartConfig: vi.fn(() => ({
		getLocalPartConfig: vi.fn(() => ({ components: [] })),
		setLocalPartConfig: vi.fn(),
	})),
	LocalPartConfigState: {
		dirty: 'DIRTY',
		clean: 'CLEAN',
		discarded: 'DISCARDED',
		saved: 'SAVED',
	},
}))

vi.mock('$lib/hooks/useHoverLinked.svelte', () => ({
	useHoveredLinkedEntities: vi.fn(() => ({ current: [] })),
}))
// required for svelte5 + jsdom as jsdom does not support matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	enumerable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
})

// Mock indexedDB for idb-keyval
const mockDB = {
	open: vi.fn(() => ({
		result: { createObjectStore: vi.fn() },
		onupgradeneeded: null,
	})),
}
;(global as unknown as { indexedDB: unknown }).indexedDB = mockDB

// add more mocks here if you need them
