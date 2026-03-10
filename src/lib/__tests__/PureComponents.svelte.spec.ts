import { vi, describe, it } from 'vitest'
import { render } from '@testing-library/svelte'
import AxesHelper from '$lib/components/AxesHelper.svelte'
import MockCanvas from './fixtures/MockCanvas.svelte'

// TODO: move this to use @threlte/test instead of mocking once it is fixed for this use case
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

describe('PureComponents component', () => {
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
