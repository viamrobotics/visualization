import type { Transform } from '$lib/geometry'
import type { ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import { createGeometryFromFrame } from '$lib/geometry'
import { internalFrameName } from '$lib/kinematicsFrames'
import { Pose } from '$lib/math'
import { obstacleGeometryLabel } from '$lib/obstacleAttributes'

const buildPhysicalObject = (entry: ObstacleGeometryConfig): Transform['physicalObject'] => {
	const geometry = createGeometryFromFrame({ geometry: entry })
	if (!geometry) {
		return undefined
	}

	return {
		...geometry,
		center: new Pose().setFromFrame({
			translation: entry.translation,
			orientation: entry.orientation,
		}),
	}
}

/**
 * Build an obstacle component's `<name>:<label>` frames from its `attributes.geometries`,
 * hung off the component's own frame, the way rdk's frame system names them.
 *
 * Each frame has an identity pose and carries its geometry at the entry's own offset. A
 * shape that cannot be drawn still gets its frame. A repeated name keeps the first entry.
 */
export const deriveObstacleFrames = (
	componentName: string,
	geometries: ObstacleGeometryConfig[]
): Transform[] => {
	const frames = new Map<string, Transform>()

	for (const [index, entry] of geometries.entries()) {
		const name = internalFrameName(componentName, obstacleGeometryLabel(entry, index))
		if (frames.has(name)) {
			continue
		}

		frames.set(name, {
			uuid: new Uint8Array(0),
			referenceFrame: name,
			poseInObserverFrame: { referenceFrame: componentName, pose: new Pose() },
			physicalObject: buildPhysicalObject(entry),
		})
	}

	return [...frames.values()]
}
