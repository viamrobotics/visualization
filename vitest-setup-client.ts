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
	useFocusedObject: vi.fn(() => ({ current: undefined })),
	useFocusedObject3d: vi.fn(() => ({ current: undefined })),
	useSelectedObject: vi.fn(() => ({ current: undefined })),
	useSelectedObject3d: vi.fn(() => ({ current: undefined })),
}))

// Mock useWeblabs hook
vi.mock('$lib/hooks/useWeblabs.svelte', () => ({
	useWeblabs: vi.fn(() => ({
		weblab: {
			isActive: vi.fn(() => false),
			load: vi.fn(),
		},
	})),
	Weblab: vi.fn().mockImplementation(() => ({
		isActive: vi.fn(() => false),
		load: vi.fn(),
	})),
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

// Mock indexedDB for idb-keyval (useDraggable hook)
const mockDB = {
	open: vi.fn(() => ({
		result: { createObjectStore: vi.fn() },
		onupgradeneeded: null,
	})),
}
;(global as unknown as { indexedDB: unknown }).indexedDB = mockDB

// add more mocks here if you need them
