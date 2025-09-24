import init, { PCDProcessor, Point3D, Color } from './pcd-processor/pkg/pcd_processor_wasm.js'
import type { Metadata } from '$lib/WorldObject.svelte'

export type { PCDProcessor, Point3D, Color }

// WASM module initialization
let wasmInitialized = false
let wasmInitPromise: Promise<void> | null = null

export const initWasm = async (): Promise<void> => {
	if (wasmInitialized) return
	if (wasmInitPromise) return wasmInitPromise

	wasmInitPromise = (async () => {
		try {
			await init()
			wasmInitialized = true
			console.info('WASM PCD Processor initialized')
		} catch (error) {
			console.error('Failed to initialize WASM PCD Processor:', error)
			throw error
		}
	})()

	return wasmInitPromise
}

// Wrapper class for easier use
export class WasmPCDProcessor {
	private processor: PCDProcessor | null = null

	constructor() {
		this.processor = null
	}

	async initialize(): Promise<void> {
		await initWasm()
		this.processor = new PCDProcessor()
	}

	isInitialized(): boolean {
		return this.processor !== null
	}

	async parsePCD(
		data: Uint8Array,
		metadata?: Metadata
	): Promise<{
		positions: Float32Array
		colors: Float32Array | null
		pointCount: number
	}> {
		if (!this.processor) {
			throw new Error('Processor not initialized')
		}

		try {
			this.processor.parse_pcd(data)

			// Skip color processing if backend already provides colors
			// This significantly reduces WASM processing time and memory usage
			// TODO: Maybe flag this in metadata instead of checking in the code
			const colors =
				metadata?.pointCloudDeltaFormat === 'index_x_y_z'
					? null
					: this.processor.get_colors() || null

			return {
				positions: this.processor.get_positions(),
				colors,
				pointCount: this.processor.point_count(),
			}
		} catch (error) {
			throw new Error(`Failed to parse PCD: ${error}`)
		}
	}

	async applyDelta(
		deltaData: Uint8Array,
		existingPositions?: Float32Array,
		existingColors?: Float32Array,
		metadata?: Metadata
	): Promise<{
		updatedIndices: number[]
		positions: Float32Array
		colors: Float32Array | null
		pointCount: number
		updatedInPlace: boolean
	}> {
		if (!this.processor) {
			throw new Error('Processor not initialized')
		}

		const skipColors = metadata?.pointCloudDeltaFormat === 'index_x_y_z'

		try {
			const updatedIndices = await this.processor.apply_delta_update(deltaData)

			let positions: Float32Array
			let colors: Float32Array | null = null
			let positionsUpdatedInPlace = false
			let colorsUpdatedInPlace = false

			// Only process positions for delta updates since backend provides colors
			// This significantly reduces WASM processing time
			if (existingPositions) {
				try {
					// Get the updated positions from WASM
					const newPositions = this.processor.get_positions()

					if (newPositions.length === existingPositions.length) {
						// Copy the new data into the existing array to maintain reference
						existingPositions.set(newPositions)
						positions = existingPositions
						positionsUpdatedInPlace = true
					} else {
						positions = newPositions
					}
				} catch (error) {
					console.error('Error getting positions from WASM:', error)
					positions = this.processor.get_positions()
				}
			} else {
				positions = this.processor.get_positions()
			}

			// Skip color processing for delta updates
			// Colors from backend are already correct and don't need WASM processing
			if (!skipColors) {
				const newColors = this.processor.get_colors()
				if (existingColors && newColors && existingColors.length === newColors.length) {
					// Copy new colors into existing array
					existingColors.set(newColors)
					colors = existingColors
					colorsUpdatedInPlace = true
				} else {
					colors = newColors || null
				}
			} else {
				// Keep existing colors without processing them in WASM
				colors = existingColors || null
				colorsUpdatedInPlace = true // Consider colors as "updated in place" since we're not changing them
			}

			// Consider in-place update successful if positions were updated in-place
			// and we're either skipping colors or colors were also updated in-place
			const updatedInPlace = positionsUpdatedInPlace && (!skipColors || colorsUpdatedInPlace)

			return {
				updatedIndices: Array.from(updatedIndices),
				positions,
				colors,
				pointCount: this.processor.point_count(),
				updatedInPlace,
			}
		} catch (error) {
			throw new Error(`Failed to apply delta: ${error}`)
		}
	}
}

// Factory function for creating instances
export const createWasmPCDProcessor = async (): Promise<WasmPCDProcessor> => {
	const processor = new WasmPCDProcessor()
	await processor.initialize()
	return processor
}

// Export types and constants
export interface PCDParseResult {
	positions: Float32Array
	colors: Float32Array | null
	pointCount: number
}

export interface PCDDeltaResult {
	updatedIndices: number[]
	positions: Float32Array
	colors: Float32Array | null
	pointCount: number
	updatedInPlace?: boolean
}

// Delta format constants
export const DELTA_FORMATS = {
	INDEX_X_Y_Z: 'index_x_y_z',
} as const

export type DeltaFormat = (typeof DELTA_FORMATS)[keyof typeof DELTA_FORMATS]
