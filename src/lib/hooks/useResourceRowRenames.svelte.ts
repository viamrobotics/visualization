import { traits, useWorld } from '#lib/ecs/index.js'

/**
 * A counter that bumps whenever a frame or frameless component is renamed in place.
 * Read `current` in an effect that keys resource rows by name, since a query over
 * those rows only reruns when one is added or removed.
 */
export const useResourceRowRenames = (): { readonly current: number } => {
	const world = useWorld()
	let renames = $state(0)

	$effect(() =>
		world.onChange(traits.Name, (entity) => {
			if (entity.has(traits.FramesAPI) || entity.has(traits.FramelessComponent)) renames += 1
		})
	)

	return {
		get current() {
			return renames
		},
	}
}
