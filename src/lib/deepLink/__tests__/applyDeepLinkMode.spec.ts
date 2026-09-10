import { beforeEach, describe, expect, it } from 'vitest'

import { applyDeepLinkMode } from '$lib/deepLink/useDeepLinkMode.svelte'
import { createEnvironment, ENVIRONMENT_MODE_STORAGE_KEY } from '$lib/hooks/useEnvironment.svelte'

describe('applyDeepLinkMode', () => {
	beforeEach(() => {
		localStorage.removeItem(ENVIRONMENT_MODE_STORAGE_KEY)
	})

	it('assigns the mode when the first value names a registered mode', () => {
		const environment = createEnvironment()
		environment.registerMode('build')

		applyDeepLinkMode(['build'], environment)

		expect(environment.current.mode).toBe('build')
	})

	it('resolves once the plugin registers, when applied before registration', () => {
		const environment = createEnvironment()
		environment.registerMode('monitor')

		applyDeepLinkMode(['build'], environment)
		expect(environment.current.mode).toBe('monitor')

		environment.registerMode('build')
		expect(environment.current.mode).toBe('build')
	})

	it('leaves the mode untouched when the first value is not a real mode', () => {
		const environment = createEnvironment()
		environment.registerMode('monitor')

		applyDeepLinkMode(['teleport'], environment)

		expect(environment.current.mode).toBe('monitor')
		expect(localStorage.getItem(ENVIRONMENT_MODE_STORAGE_KEY)).toBe(JSON.stringify('monitor'))
	})

	it('leaves the mode untouched when values is empty', () => {
		const environment = createEnvironment()
		environment.registerMode('monitor')

		applyDeepLinkMode([], environment)

		expect(environment.current.mode).toBe('monitor')
	})

	it('uses only the first value when several are given', () => {
		const environment = createEnvironment()
		environment.registerMode('move')
		environment.registerMode('build')

		applyDeepLinkMode(['move', 'build'], environment)

		expect(environment.current.mode).toBe('move')
	})

	it('persists the assigned mode through the environment setter', () => {
		const environment = createEnvironment()
		environment.registerMode('build')

		applyDeepLinkMode(['build'], environment)

		expect(localStorage.getItem(ENVIRONMENT_MODE_STORAGE_KEY)).toBe(JSON.stringify('build'))
	})
})
