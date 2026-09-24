import { describe, expect, it } from 'vitest'

import { addWidget, isWidgetOpen, removeWidget } from '../useControlWidgets.svelte'

describe('open control-widget list helpers', () => {
	const list = [
		{ resourceName: 'arm1', widgetId: 'is-moving' },
		{ resourceName: 'cam1', widgetId: '__resource_card__' },
	]

	it('isWidgetOpen reports membership by (resource, widget) pair', () => {
		expect(isWidgetOpen(list, 'arm1', 'is-moving')).toBe(true)
		expect(isWidgetOpen(list, 'arm1', 'get-joint-positions')).toBe(false)
		expect(isWidgetOpen(list, 'cam1', 'is-moving')).toBe(false)
	})

	it('addWidget appends new entries and is a no-op for duplicates', () => {
		expect(addWidget(list, 'arm1', 'get-joint-positions')).toHaveLength(3)
		expect(addWidget(list, 'arm1', 'is-moving')).toBe(list)
	})

	it('removeWidget removes only the matching entry', () => {
		expect(removeWidget(list, 'arm1', 'is-moving')).toEqual([
			{ resourceName: 'cam1', widgetId: '__resource_card__' },
		])
	})

	it('handles remote-prefixed names containing colons', () => {
		const remote = [{ resourceName: 'remote1:arm1', widgetId: 'is-moving' }]
		expect(isWidgetOpen(remote, 'remote1:arm1', 'is-moving')).toBe(true)
		expect(removeWidget(remote, 'remote1:arm1', 'is-moving')).toEqual([])
	})
})
