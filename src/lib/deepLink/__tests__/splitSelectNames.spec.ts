import { describe, expect, it } from 'vitest'

import { splitSelectNames } from '$lib/deepLink/useDeepLinkSelection.svelte'

describe('splitSelectNames', () => {
	it('splits one comma-separated value into names', () => {
		expect(splitSelectNames(['arm,gripper'])).toEqual(['arm', 'gripper'])
	})

	it('flattens a repeated key into the same list', () => {
		expect(splitSelectNames(['arm', 'gripper,base'])).toEqual(['arm', 'gripper', 'base'])
	})

	it('drops empty segments', () => {
		expect(splitSelectNames(['arm,,gripper,', ''])).toEqual(['arm', 'gripper'])
	})

	it('keeps a colon-namespaced name whole', () => {
		expect(splitSelectNames(['arm:link1,arm'])).toEqual(['arm:link1', 'arm'])
	})
})
