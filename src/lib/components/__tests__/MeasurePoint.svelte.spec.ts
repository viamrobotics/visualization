import type { Group } from 'three'

import { render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

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

vi.mock('@threlte/extras', async () => {
	const actual = await vi.importActual('@threlte/extras')
	return { ...actual }
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

	it('renders a provided label snippet in place of the default x/y/z readout', () => {
		const labelSnippet = createRawSnippet(() => ({
			render: () => '<p data-testid="measure-point-label">a surface</p>',
		}))

		render(MockCanvas, {
			child: MeasurePoint,
			position: [1, 2, 3],
			label: labelSnippet,
		})

		const wrapper = screen.getByTestId('measure-point-label').parentElement

		expect(screen.getByTestId('measure-point-label')).toBeInTheDocument()
		expect(screen.queryByText('x')).not.toBeInTheDocument()
		expect(wrapper?.className).toContain('whitespace-nowrap')
		expect(wrapper?.className).not.toContain('w-16')
	})
})
