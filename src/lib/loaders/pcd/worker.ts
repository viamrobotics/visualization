import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'

import type { Message } from './messages'

const loader = new PCDLoader()

globalThis.onmessage = async (event) => {
	const { data, id } = event.data
	if (!(data instanceof Uint8Array)) {
		postMessage({ id, error: 'Invalid data format' } satisfies Message)
		return
	}

	try {
		const pcd = loader.parse(data.buffer as ArrayBuffer)
		if (pcd.geometry) {
			/**
			 * Positions is _usually_ defined. However, we have experienced parsing PCDs from Viam APIs that
			 * result in the Three.js parser not attaching this attribute, throwing errors downstream.
			 */
			const positions =
				(pcd.geometry.attributes.position?.array as Float32Array<ArrayBuffer>) ??
				new Float32Array(0)
			const colorsFloat: Float32Array | null =
				(pcd.geometry.attributes.color?.array as Float32Array<ArrayBuffer>) ?? null
			const colors = colorsFloat ? new Uint8Array(colorsFloat.length) : null

			if (colors) {
				for (let i = 0, l = colorsFloat.length; i < l; i++) {
					colors[i] = Math.round(colorsFloat[i] * 255)
				}
			}

			postMessage(
				{ positions, colors, id } satisfies Message,
				colors ? [positions.buffer, colors.buffer] : [positions.buffer]
			)
		} else {
			postMessage({ id, error: 'Failed to extract geometry' } satisfies Message)
		}
	} catch (error) {
		postMessage({ id, error: (error as Error).message } satisfies Message)
	}
}
