import { describe, expect, it } from 'vitest'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import {
	frameAppearanceOf,
	hasFrameAppearances,
	hasResourceAppearance,
	resourceAppearanceOf,
	withFrameAppearance,
	withFrameAppearancesMoved,
	withoutFrameAppearances,
	withoutResourceAppearance,
	withResourceAppearance,
} from '$lib/resourceAppearance'

const boundsWithAppearance = (): PartComponent => ({
	name: 'bounds-1',
	visualizer: {
		type: 'bounds',
		x_mm: 1000,
		color: '#FF8800',
		opacity: 0.4,
		invisible: true,
		show_axes_helper: false,
	},
})

describe('resourceAppearanceOf', () => {
	it('reads every saved appearance key, with the color lowercased', () => {
		expect(resourceAppearanceOf(boundsWithAppearance())).toEqual({
			color: '#ff8800',
			opacity: 0.4,
			invisible: true,
			show_axes_helper: false,
		})
	})

	it.each([
		{ key: 'color', value: 'orange' },
		{ key: 'color', value: '#f80' },
		{ key: 'opacity', value: 1.5 },
		{ key: 'opacity', value: Number.NaN },
		{ key: 'invisible', value: 'yes' },
		{ key: 'show_axes_helper', value: 1 },
	])('leaves out a malformed $key of $value', ({ key, value }) => {
		const component: PartComponent = { name: 'arm', visualizer: { [key]: value } }

		expect(resourceAppearanceOf(component)).toEqual({})
	})

	it('reads nothing from a component without a visualizer config', () => {
		expect(resourceAppearanceOf({ name: 'arm' })).toEqual({})
	})
})

describe('hasResourceAppearance', () => {
	it('is false when only an obstacle hint is saved', () => {
		expect(hasResourceAppearance({ name: 'cage', visualizer: { type: 'complex' } })).toBe(false)
	})
})

describe('withResourceAppearance', () => {
	it('sets a key and keeps the obstacle hint and the other keys', () => {
		expect(withResourceAppearance(boundsWithAppearance(), { opacity: 0.9 })).toEqual({
			type: 'bounds',
			x_mm: 1000,
			color: '#FF8800',
			opacity: 0.9,
			invisible: true,
			show_axes_helper: false,
		})
	})

	it('removes a key set to undefined', () => {
		expect(
			withResourceAppearance(boundsWithAppearance(), { invisible: undefined })
		).not.toHaveProperty('invisible')
	})
})

describe('withoutResourceAppearance', () => {
	it('removes every appearance key and keeps the obstacle hint', () => {
		expect(withoutResourceAppearance(boundsWithAppearance())).toEqual({
			type: 'bounds',
			x_mm: 1000,
		})
	})
})

const cageWithShapes = (): PartComponent => ({
	name: 'cage',
	visualizer: {
		type: 'complex',
		opacity: 0.5,
		frames: { post: { color: '#00ff00' }, wall: { opacity: 0.1 } },
	},
})

describe('frameAppearanceOf', () => {
	it('reads what a frame inside the component saves', () => {
		expect(frameAppearanceOf(cageWithShapes(), 'post')).toEqual({ color: '#00ff00' })
	})

	it('reads nothing for a frame that saves nothing', () => {
		expect(frameAppearanceOf(cageWithShapes(), 'roof')).toEqual({})
	})
})

describe('hasFrameAppearances', () => {
	it('is true when a frame inside saves a value', () => {
		expect(hasFrameAppearances(cageWithShapes())).toBe(true)
	})

	it('is false without any frame entries', () => {
		expect(hasFrameAppearances({ name: 'cage', visualizer: { opacity: 0.5 } })).toBe(false)
	})
})

describe('withFrameAppearance', () => {
	it('saves a value for one frame and keeps the hint, the component values and the other frames', () => {
		expect(withFrameAppearance(cageWithShapes(), 'post', { opacity: 0.9 })).toEqual({
			type: 'complex',
			opacity: 0.5,
			frames: { post: { color: '#00ff00', opacity: 0.9 }, wall: { opacity: 0.1 } },
		})
	})

	it('drops a frame entry left empty, and the frames key once none are left', () => {
		const component: PartComponent = {
			name: 'cage',
			visualizer: { frames: { post: { opacity: 1 } } },
		}

		expect(withFrameAppearance(component, 'post', { opacity: undefined })).toEqual({})
	})
})

describe('withoutResourceAppearance on a component with frame entries', () => {
	it('keeps what the frames inside save', () => {
		expect(withoutResourceAppearance(cageWithShapes())).toEqual({
			type: 'complex',
			frames: { post: { color: '#00ff00' }, wall: { opacity: 0.1 } },
		})
	})
})

describe('withoutFrameAppearances', () => {
	it('removes every frame entry and keeps the component values', () => {
		expect(withoutFrameAppearances(cageWithShapes())).toEqual({ type: 'complex', opacity: 0.5 })
	})
})

describe('withFrameAppearancesMoved', () => {
	it('moves a renamed frame entry to its new id', () => {
		const moved = withFrameAppearancesMoved(cageWithShapes(), new Map([['post', 'pillar']]))

		expect(moved.frames).toEqual({ pillar: { color: '#00ff00' }, wall: { opacity: 0.1 } })
	})

	it('drops the entry of a removed frame', () => {
		const moved = withFrameAppearancesMoved(cageWithShapes(), new Map([['wall', undefined]]))

		expect(moved.frames).toEqual({ post: { color: '#00ff00' } })
	})

	it('swaps two entries whose frames swapped ids', () => {
		const moved = withFrameAppearancesMoved(
			cageWithShapes(),
			new Map([
				['post', 'wall'],
				['wall', 'post'],
			])
		)

		expect(moved.frames).toEqual({ wall: { color: '#00ff00' }, post: { opacity: 0.1 } })
	})
})
