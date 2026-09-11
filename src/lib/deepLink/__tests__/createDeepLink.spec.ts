import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'

import { createDeepLink, DEEP_LINK_CONTEXT_KEY } from '../useDeepLink.svelte'
import DeepLinkParamProbe from './__fixtures__/DeepLinkParamProbe.svelte'

describe('createDeepLink', () => {
	it("returns a present key's values on the first call", () => {
		const deepLink = createDeepLink(new Map([['mode', ['build']]]))

		expect(deepLink.consume('mode')).toEqual(['build'])
	})

	it('returns undefined on a second call for the same key', () => {
		const deepLink = createDeepLink(new Map([['mode', ['build']]]))

		deepLink.consume('mode')

		expect(deepLink.consume('mode')).toBeUndefined()
	})

	it('returns undefined for a key absent from the params', () => {
		const deepLink = createDeepLink(new Map([['mode', ['build']]]))

		expect(deepLink.consume('missing')).toBeUndefined()
	})

	it('leaves a different key consumable after one key is consumed', () => {
		const deepLink = createDeepLink(
			new Map([
				['mode', ['build']],
				['part', ['arm']],
			])
		)

		deepLink.consume('mode')

		expect(deepLink.consume('part')).toEqual(['arm'])
	})

	it('returns undefined for any key when the params map is empty', () => {
		const deepLink = createDeepLink(new Map())

		expect(deepLink.consume('mode')).toBeUndefined()
	})

	it('returns an empty array once for a key present with no values', () => {
		const deepLink = createDeepLink(new Map([['mode', []]]))

		expect(deepLink.consume('mode')).toEqual([])
		expect(deepLink.consume('mode')).toBeUndefined()
	})
})

describe('useDeepLinkParam', () => {
	it('calls apply exactly once with the values when the key is present', () => {
		const deepLink = createDeepLink(new Map([['mode', ['build']]]))
		const apply = vi.fn()

		render(DeepLinkParamProbe, {
			props: { key: 'mode', apply },
			context: new Map([[DEEP_LINK_CONTEXT_KEY, deepLink]]),
		})

		expect(apply).toHaveBeenCalledTimes(1)
		expect(apply).toHaveBeenCalledWith(['build'])
	})

	it('never calls apply when the key is absent', () => {
		const deepLink = createDeepLink(new Map())
		const apply = vi.fn()

		render(DeepLinkParamProbe, {
			props: { key: 'mode', apply },
			context: new Map([[DEEP_LINK_CONTEXT_KEY, deepLink]]),
		})

		expect(apply).not.toHaveBeenCalled()
	})
})
