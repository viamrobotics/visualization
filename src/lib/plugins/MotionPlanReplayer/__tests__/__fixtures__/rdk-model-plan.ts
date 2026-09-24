import type { ParsedPlan } from '../../parse-plan'

interface Vec3 {
	x?: number
	y?: number
	z?: number
}

interface RdkLink {
	id: string
	parent?: string
	translation?: Vec3
}

interface RdkJoint {
	id: string
	type: string
	parent: string
	axis: Vec3
	mimic?: { joint: string; multiplier?: number; offset?: number }
}

export interface RdkModel {
	name: string
	links: RdkLink[]
	joints: RdkJoint[]
	output_frames?: string[]
}

/** Fixtures spell vectors `{x,y,z}`, as a person writes config. RDK marshals `r3.Vector` as `{X,Y,Z}`. */
const upper = (v: Vec3 = {}): { X: number; Y: number; Z: number } => ({
	X: v.x ?? 0,
	Y: v.y ?? 0,
	Z: v.z ?? 0,
})

const MOTION: Record<string, 'rotational' | 'translational'> = {
	revolute: 'rotational',
	prismatic: 'translational',
}

/**
 * Publishes an RDK model config as a `ParsedPlan`, the way a plan reply carries it.
 * `flattenModelIntoFS` re-publishes every frame inside a model, mimic joints included, under
 * `component:internalName`.
 */
export const rdkModelPlan = (
	model: RdkModel,
	trajectory: ParsedPlan['trajectory'] = []
): ParsedPlan => {
	const component = model.name
	const frames: ParsedPlan['frames'] = {
		[component]: { frame_type: 'model', frame: { name: component, model } },
	}
	const parents: ParsedPlan['parents'] = {}

	// `world` here is the model's *internal* world, which flattening replaces with the model's own
	// attachment point. These fixtures hang off the real world, so the two spell the same.
	const namespaced = (id: string): string => (id === 'world' ? 'world' : `${component}:${id}`)

	for (const link of model.links) {
		frames[`${component}:${link.id}`] = {
			frame_type: 'named',
			frame: {
				inner_frame: {
					frame_type: 'static',
					frame: { translation: upper(link.translation), orientation: null },
				},
			},
		}
		parents[`${component}:${link.id}`] = namespaced(link.parent ?? 'world')
	}

	for (const joint of model.joints) {
		frames[`${component}:${joint.id}`] = {
			frame_type: 'named',
			frame: {
				inner_frame: { frame_type: MOTION[joint.type]!, frame: { axis: upper(joint.axis) } },
			},
		}
		parents[`${component}:${joint.id}`] = namespaced(joint.parent)
	}

	return {
		frames,
		parents,
		trajectory,
		goals: [],
		obstaclesInWorldFrame: undefined,
		worldState: undefined,
	}
}
