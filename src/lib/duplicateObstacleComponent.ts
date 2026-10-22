import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { nextObstacleName } from '$lib/obstacle'

/**
 * A copy of `component` named `<name>-N`, with N the first number `takenNames` leaves free. The
 * copy shares nothing with its source: its frame, geometries and appearance are its own, and
 * it sits at the same pose.
 */
export const duplicateObstacleComponent = (
	component: PartComponent,
	takenNames: Iterable<string>
): PartComponent => {
	const copy = structuredClone(component)
	copy.name = nextObstacleName(takenNames, component.name)
	return copy
}
