import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DesktopBridge } from '../desktopBridge'
import type { DrawServicePortState } from '../useDrawServicePort.svelte'

import { useDrawServicePort } from '../useDrawServicePort.svelte'

const drawServicePort = vi.fn<DesktopBridge['drawServicePort']>()

let cleanup: (() => void) | undefined

const installBridge = () => {
	window.viamDesktop = {
		drawServicePort,
		launchConfig: vi.fn(),
		onLaunchConfigChanged: vi.fn(),
	} satisfies DesktopBridge
}

const mountHook = (): DrawServicePortState => {
	let state: DrawServicePortState | undefined
	cleanup = $effect.root(() => {
		state = useDrawServicePort()
	})
	if (!state) throw new Error('hook did not mount')
	return state
}

describe('useDrawServicePort', () => {
	afterEach(() => {
		cleanup?.()
		cleanup = undefined
		delete window.viamDesktop
	})

	it('is ready immediately outside the desktop shell without asking', () => {
		const state = mountHook()

		expect(state.ready).toBe(true)
		expect(state.port).toBeUndefined()
		expect(drawServicePort).not.toHaveBeenCalled()
	})

	it('exposes the bundled server port as a string', async () => {
		installBridge()
		drawServicePort.mockResolvedValue(43_123)

		const state = mountHook()
		expect(state.ready).toBe(false)

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.port).toBe('43123')
	})

	it('leaves the port undefined when the shell started no server', async () => {
		installBridge()
		drawServicePort.mockResolvedValue(null)

		const state = mountHook()

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.port).toBeUndefined()
	})

	it('warns and still becomes ready when the ask fails', async () => {
		installBridge()
		drawServicePort.mockRejectedValue(new Error('ipc down'))
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

		const state = mountHook()

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.port).toBeUndefined()
		expect(warn).toHaveBeenCalledOnce()
	})
})
