import type { Group } from 'three'

import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'

import MockCanvas from '$lib/__tests__/fixtures/MockCanvas.svelte'

import MeasurePoint from '../MeasurePoint.svelte'

// @threlte/extras components call into Threlte context that needs a <Canvas> parent, which
// this fixture supplies. Mirrors the `@threlte/core` override PureComponents.svelte.spec.ts
// uses, since T.Group needs the real module rather than the globally mocked one.
vi.mock('@threlte/core', async () => {
	const actual = await vi.importActual('@threlte/core')
	return {
		...actual,
		currentWritable: vi.fn(() => ({
			subscribe: () => () => {},
			set: () => {},
			update: () => {},
		})),
	}
})

vi.mock('three', async () => {
	const actual = await vi.importActual('three')

	return {
		...actual,
		WebGLRenderer: vi.fn().mockImplementation(() => ({
			setSize: vi.fn(),
			setPixelRatio: vi.fn(),
			render: vi.fn(),
			domElement: {
				getContext: vi.fn().mockReturnValue({}),
			},
			dispose: vi.fn(),
		})),
	}
})

globalThis.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

describe('MeasurePoint', () => {
	it('positions its group at the given point', () => {
		let capturedRef: Group | undefined

		render(MockCanvas, {
			child: MeasurePoint,
			position: [1, 2, 3],
			oncreate: (ref: Group) => {
				capturedRef = ref
			},
		})

		expect(capturedRef?.position.toArray()).toEqual([1, 2, 3])
	})
})
