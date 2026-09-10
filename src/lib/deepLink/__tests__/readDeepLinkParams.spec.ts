import { describe, expect, it } from 'vitest'

import { readDeepLinkParams } from '$lib/deepLink/readDeepLinkParams'

describe('readDeepLinkParams', () => {
	it('drops a key with no viz. prefix', () => {
		expect([...readDeepLinkParams('foo=bar')]).toEqual([])
	})

	it('strips the prefix from a kept key', () => {
		expect(readDeepLinkParams('viz.select=arm').get('select')).toEqual(['arm'])
	})

	it('collects a repeated key in URL order', () => {
		expect(readDeepLinkParams('viz.select=arm&viz.select=base').get('select')).toEqual([
			'arm',
			'base',
		])
	})

	it('returns an empty map for an empty string', () => {
		expect([...readDeepLinkParams('')]).toEqual([])
	})

	it('parses a string with a leading question mark the same as one without', () => {
		expect(readDeepLinkParams('?viz.select=arm').get('select')).toEqual(
			readDeepLinkParams('viz.select=arm').get('select')
		)
	})

	it('yields the same map for an equivalent URLSearchParams input', () => {
		expect([...readDeepLinkParams(new URLSearchParams('viz.select=arm'))]).toEqual([
			...readDeepLinkParams('viz.select=arm'),
		])
	})

	it('drops a key that is only the prefix', () => {
		expect([...readDeepLinkParams('viz.=arm')]).toEqual([])
	})

	it('leaves a value containing a colon unchanged', () => {
		expect(readDeepLinkParams('viz.select=arm:link1').get('select')).toEqual(['arm:link1'])
	})
})
