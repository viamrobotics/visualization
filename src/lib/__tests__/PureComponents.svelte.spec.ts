import { vi, describe, it } from 'vitest'
import { render } from '@testing-library/svelte'
import AxesHelper from '$lib/components/AxesHelper.svelte'
import Geometry from '$lib/components/Geometry.svelte'
import MockCanvas from './fixtures/MockCanvas.svelte'

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

global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

describe('PureComponents component', () => {
	it('should render geometry component', () => {
		render(MockCanvas, {
			child: Geometry,
			uuid: '123',
			name: 'test',
			pose: {
				x: 0,
				y: 0,
				z: 0,
				oX: 0,
				oY: 0,
				oZ: 0,
				theta: 0,
			},
			metadata: {},
		})
	})

	it('should render axes helper component', () => {
		render(MockCanvas, {
			child: AxesHelper,
			length: 1,
			width: 0.1,
			axesColors: ['red', 'green', 'blue'],
			depthTest: true,
		})
	})
})
