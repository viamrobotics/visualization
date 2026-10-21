import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LaunchConfigState } from '../useLaunchConfig.svelte'

import { useLaunchConfig } from '../useLaunchConfig.svelte'

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
	isTauri: vi.fn(),
}))
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(),
}))

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

let cleanup: (() => void) | undefined
let emit: ((payload: unknown) => void) | undefined
const unlisten = vi.fn()

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
		addLog.mockReset()
		vi.mocked(invoke).mockReset()
		vi.mocked(isTauri).mockReset()
		unlisten.mockReset()
		vi.mocked(listen).mockReset()
		vi.mocked(listen).mockImplementation((_name, handler) => {
			emit = (payload) => (handler as (event: { payload: unknown }) => void)({ payload })
			return Promise.resolve(unlisten)
		})
	})

	afterEach(() => {
		cleanup?.()
		cleanup = undefined
	})

	it('is ready immediately outside Tauri without invoking', () => {
		vi.mocked(isTauri).mockReturnValue(false)

		const state = mountHook()

		expect(state.ready).toBe(true)
		expect(state.current).toBeUndefined()
		expect(invoke).not.toHaveBeenCalled()
	})

	it('resolves a config in Tauri', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		vi.mocked(invoke).mockResolvedValue({ config: validConfig('p1'), error: null })

		const state = mountHook()
		expect(state.ready).toBe(false)

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.current?.partId).toBe('p1')
		expect(state.error).toBeUndefined()
	})

	it('surfaces an error from the Rust side', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		vi.mocked(invoke).mockResolvedValue({ config: null, error: 'file unreadable' })

		const state = mountHook()

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.error).toBe('file unreadable')
		expect(state.current).toBeUndefined()
		expect(addLog).toHaveBeenCalledWith('Launch file: file unreadable', 'error')
	})

	it('asks for the config only once listening', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		let resolveListen: (() => void) | undefined
		vi.mocked(listen).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveListen = () => resolve(unlisten)
				})
		)
		vi.mocked(invoke).mockResolvedValue(null)

		const state = mountHook()
		await vi.waitFor(() => expect(resolveListen).toBeDefined())
		expect(invoke).not.toHaveBeenCalled()

		resolveListen?.()
		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(invoke).toHaveBeenCalledOnce()
	})

	it('keeps an event that lands before the invoke answer', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		let resolveInvoke: ((payload: unknown) => void) | undefined
		vi.mocked(invoke).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveInvoke = resolve
				})
		)

		const state = mountHook()
		await vi.waitFor(() => expect(resolveInvoke).toBeDefined())

		emit?.({ config: validConfig('newer'), error: null })
		resolveInvoke?.({ config: validConfig('older'), error: null })

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.current?.partId).toBe('newer')
	})

	it('ignores an invoke answer that arrives after teardown', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		let resolveInvoke: ((payload: unknown) => void) | undefined
		vi.mocked(invoke).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveInvoke = resolve
				})
		)

		const state = mountHook()
		await vi.waitFor(() => expect(resolveInvoke).toBeDefined())

		cleanup?.()
		cleanup = undefined
		resolveInvoke?.({ config: validConfig('late'), error: null })
		await Promise.resolve()
		await Promise.resolve()

		expect(state.current).toBeUndefined()
		expect(state.ready).toBe(false)
	})

	it('turns a rejected invoke into an error and still becomes ready', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		vi.mocked(invoke).mockRejectedValue(new Error('ipc down'))

		const state = mountHook()

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.error).toBe('ipc down')
	})

	it('turns an invalid config into a parse error', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		vi.mocked(invoke).mockResolvedValue({
			config: { ...validConfig('p1'), version: 2 },
			error: null,
		})

		const state = mountHook()

		await vi.waitFor(() => expect(state.ready).toBe(true))
		expect(state.error).toContain('version 2')
		expect(state.current).toBeUndefined()
	})

	it('replaces the current config on an event and clears a stale error', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		vi.mocked(invoke).mockResolvedValue({ config: null, error: 'stale' })

		const state = mountHook()
		await vi.waitFor(() => expect(state.error).toBe('stale'))
		await vi.waitFor(() => expect(emit).toBeDefined())

		emit?.({ config: validConfig('p2'), error: null })

		expect(state.current?.partId).toBe('p2')
		expect(state.error).toBeUndefined()

		emit?.({ config: null, error: 'bad second launch' })

		expect(state.current).toBeUndefined()
		expect(state.error).toBe('bad second launch')
	})

	it('unlistens on teardown', async () => {
		vi.mocked(isTauri).mockReturnValue(true)
		vi.mocked(invoke).mockResolvedValue(null)

		mountHook()
		await vi.waitFor(() => expect(emit).toBeDefined())

		cleanup?.()
		cleanup = undefined

		await vi.waitFor(() => expect(unlisten).toHaveBeenCalledOnce())
	})
})
