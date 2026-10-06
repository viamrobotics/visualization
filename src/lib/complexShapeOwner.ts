import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { ownerOfInternalFrame } from '$lib/kinematicsFrames'

/**
 * The part-owned obstacle a Complex shape's `<name>:<label>` frame belongs to. The shape is
 * edited through its entry in that obstacle's `attributes.geometries`.
 */
export const complexShapeOwner = (
	components: PartComponent[] | undefined,
	frameName: string | undefined
): PartComponent | undefined => {
	if (frameName === undefined) return undefined
	const owner = ownerOfInternalFrame(frameName)
	if (owner === undefined) return undefined
	return components?.find((component) => component.name === owner)
}
