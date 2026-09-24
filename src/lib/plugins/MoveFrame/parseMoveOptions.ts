import { Constraints, WorldState } from '@viamrobotics/sdk'

/** The optional arguments of a motion `Move` call, once parsed from their JSON fields. */
export interface MoveOptions {
	worldState: WorldState | undefined
	constraints: Constraints | undefined
}

/**
 * Parses the panel's optional `WorldState` / `Constraints` fields into the
 * messages `MotionClient.move` takes.
 *
 * An empty (or whitespace-only) field means "omit". Anything else is parsed
 * with the generated message classes, which throw on invalid input — callers
 * surface that to the user.
 */
export const parseMoveOptions = (worldStateJson: string, constraintsJson: string): MoveOptions => ({
	worldState:
		worldStateJson.trim() === '' ? undefined : WorldState.fromJsonString(worldStateJson.trim()),
	constraints:
		constraintsJson.trim() === '' ? undefined : Constraints.fromJsonString(constraintsJson.trim()),
})
