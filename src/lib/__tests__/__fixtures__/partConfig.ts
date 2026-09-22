import { vi } from 'vitest'

import type { PartConfigContext } from '$lib/hooks/usePartConfig.svelte'

/** A readable, editable config with no components, for `usePartConfig` to return. */
export const createPartConfigFixture = (
	overrides: Partial<PartConfigContext> = {}
): PartConfigContext => ({
	current: { components: [] },
	isReady: true,
	isDirty: false,
	hasEditPermissions: true,
	createComponent: vi.fn(),
	createFrame: vi.fn(),
	deleteFrame: vi.fn(),
	updateFrame: vi.fn(),
	save: vi.fn(),
	discardChanges: vi.fn(),
	canUndoFrameEdit: false,
	canRedoFrameEdit: false,
	undoFrameEdit: vi.fn(),
	redoFrameEdit: vi.fn(),
	beginFrameEditHistoryEntry: vi.fn(),
	endFrameEditHistoryEntry: vi.fn(),
	...overrides,
})
