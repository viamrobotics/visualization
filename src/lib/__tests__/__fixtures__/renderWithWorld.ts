import type { World } from 'koota'
import type { Component } from 'svelte'

import { render } from '@testing-library/svelte'

import WithWorld from './WithWorld.svelte'

interface RenderWithWorldOptions<TProps extends object> {
	world: World
	props: TProps
	context?: Map<unknown, unknown>
}

/**
 * Renders `component` beneath a koota `provideWorld(world)`. Other contexts pass through
 * `context` as they would with `render`.
 */
export const renderWithWorld = <TProps extends object>(
	component: Component<TProps>,
	{ world, props, context }: RenderWithWorldOptions<TProps>
) => render(WithWorld, { props: { world, component, props }, context })
