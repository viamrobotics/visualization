import { invoke, isTauri } from '@tauri-apps/api/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DrawServicePortState } from '../useDrawServicePort.svelte'

import { useDrawServicePort } from '../useDrawServicePort.svelte'

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
	isTauri: vi.fn(),
}))

let cleanup: (() => void) | undefined

const mountHook = (): DrawServicePortState => {
	let state: DrawServicePortState | undefined
	cleanup = $effect.root(() => {
		state = useDrawServicePort()
	})
	if (!state) throw new Error('hook did not mount')
	return state
}

describe('useDrawServicePort', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockReset()
		vi.mocked(isTauri).mockReset()
	})

	afterEach(() => {
		cleanup?.()
		cleanup = undefined
	})

	it('is ready immediately outside Tauri without invoking', () => {
		vi.mocked(isTauri).mockReturnValue(false)

		const state = mountHook()

		expect(state.ready).toBe(true)
		expect(state.port).toBeUndefined()
		expect(invoke).not.toHaveBeenCalled()
	})

	it('exposes the sidecar port as a string in Tauri', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		vi.mocked(invoke).mockResolvedValue(43_123)

		const state = mountHook()
		expect(state.ready).toBe(false)

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.port).toBe('43123')
	})

	it('leaves the port undefined when no sidecar was spawned', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		vi.mocked(invoke).mockResolvedValue(null)

		const state = mountHook()

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.port).toBeUndefined()
	})

	it('warns and still becomes ready when invoke rejects', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		vi.mocked(invoke).mockRejectedValue(new Error('ipc down'))
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

		const state = mountHook()

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.port).toBeUndefined()
		expect(warn).toHaveBeenCalledOnce()
		warn.mockClear()
	})
})
