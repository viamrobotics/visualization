import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesktopBridge } from '../desktopBridge'
import type { LaunchConfigPayload } from '../launchConfig'
import type { LaunchConfigState } from '../useLaunchConfig.svelte'

import { useLaunchConfig } from '../useLaunchConfig.svelte'

const addLog = vi.fn()
vi.mock('$lib/plugins/Logs/useLogs.svelte', () => ({
	useLogs: () => ({ add: addLog }),
}))

const validConfig = (partId: string) => ({
	version: 1,
	host: 'part.local.viam.cloud',
	partId,
	partName: 'main',
	machineName: 'arm-rig',
	signalingAddress: 'https://app.viam.com:443',
	serviceHost: 'https://app.viam.com',
	credentials: { type: 'access-token', payload: 'tok' },
})

const launchConfig = vi.fn<DesktopBridge['launchConfig']>()
const unsubscribe = vi.fn()
const onLaunchConfigChanged = vi.fn<DesktopBridge['onLaunchConfigChanged']>()
let emit: ((payload: LaunchConfigPayload) => void) | undefined
let cleanup: (() => void) | undefined

const installBridge = () => {
	window.viamDesktop = {
		drawServicePort: vi.fn(),
		launchConfig,
		onLaunchConfigChanged,
	} satisfies DesktopBridge
}

const deferredLaunchConfig = () => {
	let resolve: ((payload: LaunchConfigPayload | null) => void) | undefined
	launchConfig.mockImplementation(
		() =>
			new Promise((settle) => {
				resolve = settle
			})
	)
	return { resolve: (payload: LaunchConfigPayload | null) => resolve?.(payload) }
}

const mountHook = (): LaunchConfigState => {
	let state: LaunchConfigState | undefined
	cleanup = $effect.root(() => {
		state = useLaunchConfig()
	})
	if (!state) throw new Error('hook did not mount')
	return state
}

describe('useLaunchConfig', () => {
	beforeEach(() => {
		emit = undefined
		onLaunchConfigChanged.mockImplementation((listener) => {
			emit = listener
			return unsubscribe
		})
	})

	afterEach(() => {
		cleanup?.()
		cleanup = undefined
		delete window.viamDesktop
	})

	it('is ready immediately outside the desktop shell without asking', () => {
		const state = mountHook()

		expect(state.ready).toBe(true)
		expect(state.current).toBeUndefined()
		expect(launchConfig).not.toHaveBeenCalled()
	})

	it('resolves a config from the desktop shell', async () => {
		installBridge()
		launchConfig.mockResolvedValue({ config: validConfig('p1'), error: null })

		const state = mountHook()
		expect(state.ready).toBe(false)

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.current?.partId).toBe('p1')
		expect(state.error).toBeUndefined()
	})

	it('surfaces and logs an error from the main process', async () => {
		installBridge()
		launchConfig.mockResolvedValue({ config: null, error: 'file unreadable' })

		const state = mountHook()

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.error).toBe('file unreadable')
		expect(state.current).toBeUndefined()
		expect(addLog).toHaveBeenCalledWith('Launch file: file unreadable', 'error')
	})

	it('subscribes to changes before asking for the current config', async () => {
		installBridge()
		launchConfig.mockResolvedValue(null)

		const state = mountHook()
		await vi.waitFor(() => expect(state.ready).toBe(true))

		expect(onLaunchConfigChanged.mock.invocationCallOrder[0]).toBeLessThan(
			launchConfig.mock.invocationCallOrder[0] ?? 0
		)
	})

	it('keeps a change that lands before the answer to the first ask', async () => {
		installBridge()
		const answer = deferredLaunchConfig()

		const state = mountHook()
		await vi.waitFor(() => expect(launchConfig).toHaveBeenCalledOnce())

		emit?.({ config: validConfig('newer'), error: null })
		answer.resolve({ config: validConfig('older'), error: null })

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.current?.partId).toBe('newer')
	})

	it('ignores an answer that arrives after teardown', async () => {
		installBridge()
		const answer = deferredLaunchConfig()

		const state = mountHook()
		await vi.waitFor(() => expect(launchConfig).toHaveBeenCalledOnce())

		cleanup?.()
		cleanup = undefined
		answer.resolve({ config: validConfig('late'), error: null })
		await Promise.resolve()
		await Promise.resolve()

		expect(state.current).toBeUndefined()
		expect(state.ready).toBe(false)
	})

	it('turns a rejected ask into an error and still becomes ready', async () => {
		installBridge()
		launchConfig.mockRejectedValue(new Error('ipc down'))

		const state = mountHook()

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.error).toBe('ipc down')
	})

	it('turns an invalid config into a parse error', async () => {
		installBridge()
		launchConfig.mockResolvedValue({ config: { ...validConfig('p1'), version: 2 }, error: null })

		const state = mountHook()

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.error).toContain('version 2')
		expect(state.current).toBeUndefined()
	})

	it('replaces the current config on a change and clears a stale error', async () => {
		installBridge()
		launchConfig.mockResolvedValue({ config: null, error: 'stale' })

		const state = mountHook()
		await vi.waitFor(() => expect(state.error).toBe('stale'))

		emit?.({ config: validConfig('p2'), error: null })

		expect(state.current?.partId).toBe('p2')
		expect(state.error).toBeUndefined()
	})

	it('replaces a config with the error from a bad relaunch', async () => {
		installBridge()
		launchConfig.mockResolvedValue({ config: validConfig('p1'), error: null })

		const state = mountHook()
		await vi.waitFor(() => expect(state.current?.partId).toBe('p1'))

		emit?.({ config: null, error: 'bad second launch' })

		expect(state.current).toBeUndefined()
		expect(state.error).toBe('bad second launch')
	})

	it('unsubscribes on teardown', async () => {
		installBridge()
		launchConfig.mockResolvedValue(null)

		const state = mountHook()
		await vi.waitFor(() => expect(state.ready).toBe(true))

		cleanup?.()
		cleanup = undefined

		expect(unsubscribe).toHaveBeenCalledOnce()
	})
})
