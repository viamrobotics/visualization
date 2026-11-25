import type { ResourceName } from '@viamrobotics/sdk'
import type { Component } from 'svelte'

import {
	ResourceDoCommandWidget,
	showResourceWidget,
	supportsDoCommand,
} from '@viamrobotics/test-widgets'
import { apiWidgetsForResource, widgetForResource } from '@viamrobotics/test-widgets/registry'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	CARD_WIDGET_ID,
	DO_COMMAND_WIDGET_ID,
	MOTION_MOVE_WIDGET_ID,
	resourceWidgetToggles,
} from '../resourceWidgetToggles'

vi.mock('@viamrobotics/test-widgets/registry', () => ({
	apiWidgetsForResource: vi.fn(),
	widgetForResource: vi.fn(),
}))

vi.mock('@viamrobotics/test-widgets', () => ({
	showResourceWidget: vi.fn(),
	supportsDoCommand: vi.fn(),
	getResourceAPI: ({ namespace, type, subtype }: ResourceName) => `${namespace}:${type}:${subtype}`,
	ResourceTriplets: { Motion: 'rdk:service:motion' },
	ResourceDoCommandWidget: () => undefined,
}))

const widget = (() => undefined) as unknown as Component<{ partID: string; resourceName: string }>

const resource = (subtype: string, type = 'component', namespace = 'rdk'): ResourceName =>
	({ namespace, type, subtype, name: `my-${subtype}` }) as ResourceName

beforeEach(() => {
	vi.mocked(apiWidgetsForResource).mockReturnValue([])
	vi.mocked(widgetForResource).mockReturnValue(undefined)
	vi.mocked(showResourceWidget).mockReturnValue(true)
	vi.mocked(supportsDoCommand).mockReturnValue(false)
})

describe('resourceWidgetToggles', () => {
	it('returns the per-API widgets (and no card) when the resource has APIs', () => {
		const apis = [{ id: 'get-joint-positions', label: 'GetJointPositions', widgets: [widget] }]
		vi.mocked(apiWidgetsForResource).mockReturnValue(apis)
		// Even if a card exists, a resource with APIs must not surface it.
		vi.mocked(widgetForResource).mockReturnValue(widget)

		const result = resourceWidgetToggles(resource('arm'))

		expect(result).toEqual(apis)
		expect(result.some((toggle) => toggle.id === CARD_WIDGET_ID)).toBe(false)
	})

	it('falls back to a single card toggle when the resource has no APIs', () => {
		vi.mocked(widgetForResource).mockReturnValue(widget)

		const result = resourceWidgetToggles(resource('camera'))

		expect(result).toHaveLength(1)
		expect(result[0]?.id).toBe(CARD_WIDGET_ID)
		expect(result[0]?.widgets).toEqual([widget])
	})

	it('returns nothing when there are no APIs and no card', () => {
		expect(resourceWidgetToggles(resource('generic'))).toEqual([])
	})

	it('does not surface a card when the registry hides the resource', () => {
		vi.mocked(widgetForResource).mockReturnValue(widget)
		vi.mocked(showResourceWidget).mockReturnValue(false)

		expect(resourceWidgetToggles(resource('sensor', 'component', 'rdk-internal'))).toEqual([])
	})

	it('surfaces the motion service Move control even when the registry hides it', () => {
		// The registry lists no per-API widgets for motion and `showResourceWidget` hides
		// it, yet its card (the frame-aware Move widget) must still be offered here.
		vi.mocked(widgetForResource).mockReturnValue(widget)
		vi.mocked(showResourceWidget).mockReturnValue(false)

		const result = resourceWidgetToggles(resource('motion', 'service'))

		expect(result).toHaveLength(1)
		expect(result[0]?.id).toBe(MOTION_MOVE_WIDGET_ID)
		expect(result[0]?.label).toBe('Move')
		expect(result[0]?.widgets).toEqual([widget])
	})

	it('prefers real per-API widgets over the motion bail-out when the registry has them', () => {
		const apis = [{ id: 'move', label: 'Move', widgets: [widget] }]
		vi.mocked(apiWidgetsForResource).mockReturnValue(apis)
		vi.mocked(widgetForResource).mockReturnValue(widget)

		expect(resourceWidgetToggles(resource('motion', 'service'))).toEqual(apis)
	})

	it('includes a service card when the registry surfaces one', () => {
		vi.mocked(widgetForResource).mockReturnValue(widget)

		const result = resourceWidgetToggles(resource('navigation', 'service'))

		expect(result).toHaveLength(1)
		expect(result[0]?.id).toBe(CARD_WIDGET_ID)
	})
})

describe('resourceWidgetToggles — DoCommand', () => {
	beforeEach(() => {
		vi.mocked(supportsDoCommand).mockReturnValue(true)
	})

	it('appends a DoCommand toggle after the per-API widgets', () => {
		const apis = [{ id: 'get-joint-positions', label: 'GetJointPositions', widgets: [widget] }]
		vi.mocked(apiWidgetsForResource).mockReturnValue(apis)

		const result = resourceWidgetToggles(resource('arm'))

		expect(result).toHaveLength(2)
		expect(result[0]).toEqual(apis[0])
		expect(result.at(-1)).toEqual({
			id: DO_COMMAND_WIDGET_ID,
			label: 'DoCommand',
			widgets: [ResourceDoCommandWidget],
		})
	})

	it('appends a DoCommand toggle after the composite card', () => {
		vi.mocked(widgetForResource).mockReturnValue(widget)

		const result = resourceWidgetToggles(resource('camera'))

		expect(result.map((toggle) => toggle.id)).toEqual([CARD_WIDGET_ID, DO_COMMAND_WIDGET_ID])
	})

	it('offers only DoCommand for a capable resource with no card or APIs (generic)', () => {
		const result = resourceWidgetToggles(resource('generic'))

		expect(result).toHaveLength(1)
		expect(result[0]?.id).toBe(DO_COMMAND_WIDGET_ID)
		expect(result[0]?.widgets).toEqual([ResourceDoCommandWidget])
	})

	it('offers DoCommand for the motion service alongside its Move control', () => {
		vi.mocked(widgetForResource).mockReturnValue(widget)
		vi.mocked(showResourceWidget).mockReturnValue(false)

		const result = resourceWidgetToggles(resource('motion', 'service'))

		expect(result.map((toggle) => toggle.id)).toEqual([MOTION_MOVE_WIDGET_ID, DO_COMMAND_WIDGET_ID])
	})

	it('omits DoCommand for an unsupported resource', () => {
		vi.mocked(supportsDoCommand).mockReturnValue(false)
		vi.mocked(widgetForResource).mockReturnValue(widget)

		const result = resourceWidgetToggles(resource('ml_model', 'service'))

		expect(result.map((toggle) => toggle.id)).toEqual([CARD_WIDGET_ID])
	})

	it('omits DoCommand for a hidden resource even when it is capable', () => {
		vi.mocked(showResourceWidget).mockReturnValue(false)

		expect(resourceWidgetToggles(resource('sensor', 'component', 'rdk-internal'))).toEqual([])
	})
})
