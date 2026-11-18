import { TimestampQuery, type WebGPURenderer } from 'three/webgpu'

/** Not in `@types/three`: the switch the backend checks before writing timestamp queries. */
interface TimestampBackend {
	trackTimestamp: boolean
}

export interface GpuFrameTimer {
	dispose: () => void
	/** Milliseconds the GPU spent per frame, averaged over the most recently resolved frames. */
	readonly elapsedMs: number
	end: () => void
}

/**
 * Measures how long the GPU spends rendering each frame. Call `end` once per rendered frame.
 *
 * Returns `undefined` where the device has no `timestamp-query` feature, which on the
 * WebGL2 backend means no `EXT_disjoint_timer_query_webgl2`: Safari and a stock Firefox.
 *
 * Turns the renderer's timestamp tracking on for as long as the timer lives. Queries
 * resolve some frames after they are issued, so `elapsedMs` trails the frame on screen.
 */
export const createGpuFrameTimer = (renderer: WebGPURenderer): GpuFrameTimer | undefined => {
	if (!renderer.hasFeature('timestamp-query')) {
		return undefined
	}

	const backend = renderer.backend as unknown as TimestampBackend
	backend.trackTimestamp = true

	let elapsedMs = 0
	let framesSinceResolve = 0
	let isResolving = false
	let isDisposed = false
	// Queries an earlier timer left unresolved in the pool would skew the first average.
	let isFirstResolve = true

	const resolve = async (frames: number): Promise<void> => {
		isResolving = true

		try {
			const totalMs = await renderer.resolveTimestampsAsync(TimestampQuery.RENDER)

			if (isDisposed || totalMs === undefined) {
				return
			}

			if (isFirstResolve) {
				isFirstResolve = false
				return
			}

			elapsedMs = totalMs / frames
		} finally {
			isResolving = false
		}
	}

	return {
		dispose() {
			isDisposed = true
			backend.trackTimestamp = false
		},

		get elapsedMs() {
			return elapsedMs
		},

		end() {
			framesSinceResolve += 1

			if (isResolving) {
				return
			}

			const frames = framesSinceResolve
			framesSinceResolve = 0
			void resolve(frames)
		},
	}
}
