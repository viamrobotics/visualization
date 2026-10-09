import { untrack } from 'svelte'

import { traits, useQuery } from '$lib/ecs'
import { applyConfigAppearance } from '$lib/ecs/applyConfigAppearance'
import { savedAppearanceOf } from '$lib/resourceAppearance'

import { usePartConfig } from './usePartConfig.svelte'

/**
 * Applies the appearance saved in each part component's `visualizer` config to its frames, in
 * monitor and build mode alike. Color is resolved by `useFrames` instead.
 */
export const provideConfigAppearance = (): void => {
	const partConfig = usePartConfig()
	const frames = useQuery(traits.FramesAPI, traits.Name)

	const appearanceByComponent = $derived(
		new Map(
			(partConfig.current.components ?? []).map((component) => [
				component.name,
				savedAppearanceOf(component),
			])
		)
	)

	$effect(() => {
		const byComponent = appearanceByComponent
		const entities = frames.current

		untrack(() => {
			for (const entity of entities) applyConfigAppearance(entity, byComponent)
		})
	})
}
