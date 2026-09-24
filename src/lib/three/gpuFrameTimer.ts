import type { WebGLRenderer } from 'three'

/** Not in lib.dom: the WebGL2 form of `EXT_disjoint_timer_query`. */
interface DisjointTimerQuery {
	GPU_DISJOINT_EXT: GLenum
	TIME_ELAPSED_EXT: GLenum
}

export interface GpuFrameTimer {
	begin: () => void
	dispose: () => void
	/** Milliseconds the GPU spent on the most recently resolved measurement. */
	readonly elapsedMs: number
	end: () => void
}

/**
 * Measures how long the GPU spends on the work issued between `begin` and `end`.
 *
 * Returns `undefined` where `EXT_disjoint_timer_query_webgl2` is missing, which
 * is Safari and a stock Firefox.
 *
 * The GPU resolves a query some frames after it is issued, so `elapsedMs` trails
 * the frame on screen. Only one query is in flight at a time: frames that begin
 * while the previous query is still resolving go unmeasured.
 */
export const createGpuFrameTimer = (renderer: WebGLRenderer): GpuFrameTimer | undefined => {
	const gl = renderer.getContext()

	if (!('createQuery' in gl)) {
		return undefined
	}

	const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as DisjointTimerQuery | null

	if (extension === null) {
		return undefined
	}

	let active: null | WebGLQuery = null
	let pending: null | WebGLQuery = null
	let elapsedMs = 0

	const resolvePending = (): void => {
		if (pending === null) {
			return
		}

		const available = gl.getQueryParameter(pending, gl.QUERY_RESULT_AVAILABLE) as boolean

		if (!available) {
			return
		}

		// The GPU was interrupted while timing, so the result is meaningless.
		// Reading the flag also clears it.
		const disjoint = gl.getParameter(extension.GPU_DISJOINT_EXT) as boolean

		if (!disjoint) {
			elapsedMs = (gl.getQueryParameter(pending, gl.QUERY_RESULT) as number) / 1e6
		}

		gl.deleteQuery(pending)
		pending = null
	}

	return {
		begin() {
			resolvePending()

			if (active !== null || pending !== null) {
				return
			}

			active = gl.createQuery()

			if (active !== null) {
				gl.beginQuery(extension.TIME_ELAPSED_EXT, active)
			}
		},

		dispose() {
			if (active !== null) {
				gl.endQuery(extension.TIME_ELAPSED_EXT)
				gl.deleteQuery(active)
				active = null
			}

			if (pending !== null) {
				gl.deleteQuery(pending)
				pending = null
			}
		},

		get elapsedMs() {
			return elapsedMs
		},

		end() {
			if (active === null) {
				return
			}

			gl.endQuery(extension.TIME_ELAPSED_EXT)
			pending = active
			active = null
		},
	}
}
