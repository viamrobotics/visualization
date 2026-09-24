import type { Bounds } from '../../attribute'
import type { SerializedPointsBvh } from '../../three/pointsBvh'

/** For callers with no budget to hand down, such as the draw service's clouds. */
export const DEFAULT_SHUFFLE_DEPTH = 1_000_000

export interface SuccessMessage {
	id: number
	positions: Float32Array
	colors: Uint8Array | undefined
	bounds: Bounds | undefined
	/**
	 * How many leading points came back as a uniform subsample. Travels with the data because a
	 * budget raised after the parse would otherwise decimate into the scan-ordered tail.
	 */
	shuffled: number
	/**
	 * Absent on the same clouds `bounds` is absent on, those that parse without a position
	 * attribute. The renderer builds its own tree in that case.
	 */
	boundsTree: SerializedPointsBvh | undefined
}

export type Message =
	| SuccessMessage
	| {
			id: number
			error: string
	  }
