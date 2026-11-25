import { beforeEach, describe, expect, it } from 'vitest'

import { applyDeepLinkMode } from '#lib/deepLink/useDeepLinkMode.svelte.js'
import {
	createEnvironment,
	ENVIRONMENT_MODE_STORAGE_KEY,
} from '#lib/hooks/useEnvironment.svelte.js'

const STORED_MODE_KEY = `test:${ENVIRONMENT_MODE_STORAGE_KEY}`

describe('applyDeepLinkMode', () => {
	beforeEach(() => {
		localStorage.removeItem(STORED_MODE_KEY)
	})

	it('assigns the mode when the first value names a registered mode', () => {
		const environment = createEnvironment()
		environment.registerMode('build')

		applyDeepLinkMode(['build'], environment)

		expect(environment.current.mode).toBe('build')
	})

	it('assigns replay mode', () => {
		const environment = createEnvironment()
		environment.registerMode('monitor')
		environment.registerMode('replay')

		applyDeepLinkMode(['replay'], environment)

		expect(environment.current.mode).toBe('replay')
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
		const environment = createEnvironment('test')
		environment.registerMode('monitor')

		applyDeepLinkMode(['teleport'], environment)

		expect(environment.current.mode).toBe('monitor')
		expect(localStorage.getItem(STORED_MODE_KEY)).toBe(JSON.stringify('monitor'))
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
		const environment = createEnvironment('test')
		environment.registerMode('build')

		applyDeepLinkMode(['build'], environment)

		expect(localStorage.getItem(STORED_MODE_KEY)).toBe(JSON.stringify('build'))
	})
})
