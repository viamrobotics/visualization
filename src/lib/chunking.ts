import type { Entity, World } from 'koota'

import { writeBufferGeometryRange } from '$lib/attribute'
import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
import { traits } from '$lib/ecs'
import { type Metadata } from '$lib/metadata'

// NOTE: This is built assuming point cloud position data + metadata colors and opacities.
// We could generalize this if we decide to support chunking for other entity types.

export interface EntityChunk {
	/** Element offset (in points) where this chunk should be written. */
	start: number
	/** Flat `[x, y, z, ...]` positions in meters. */
	positions: Float32Array
	/** Optional colors aligned with `positions`. */
	colors?: Uint8Array
	/** Optional per-vertex opacities aligned with `positions`. */
	opacities?: Uint8Array
	/** `true` when the server has no more chunks for this entity. */
	done: boolean
}

export type ChunkFetcher = (
	uuid: string,
	start: number,
	signal: AbortSignal
) => Promise<EntityChunk | null>

export interface ChunkLoaderOptions {
	world: World
	invalidate: () => void
	fetchChunk: ChunkFetcher
	colorFormat?: ColorFormat
}

export const createChunkLoader = ({
	world,
	invalidate,
	fetchChunk,
	colorFormat = ColorFormat.RGB,
}: ChunkLoaderOptions) => {
	const active = new Set<string>()
	const controller = new AbortController()

	const pull = async (uuid: string, entity: Entity, total: number, firstChunkEnd: number) => {
		if (active.has(uuid)) return
		active.add(uuid)

		const { signal } = controller
		let nextStart = firstChunkEnd

		try {
			while (!signal.aborted) {
				const chunk = await fetchChunk(uuid, nextStart, signal)
				if (signal.aborted || !chunk) break

				const buffer = entity.get(traits.BufferGeometry)
				if (!buffer) break

				writeBufferGeometryRange(buffer, chunk.positions, chunk.start, {
					colorFormat,
					colors: chunk.colors,
					opacities: chunk.opacities,
				})

				const chunkElements = chunk.positions.length / 3
				nextStart = chunk.start + chunkElements
				entity.set(traits.ChunkProgress, { loaded: nextStart, total })
				invalidate()

				if (chunk.done) break
			}
		} catch (error) {
			if (!signal.aborted) {
				console.error(`Chunk pull failed for entity ${uuid}:`, error)
			}
		} finally {
			active.delete(uuid)
			if (world.has(entity)) {
				entity.remove(traits.ChunkProgress)
			}
		}
	}

	return {
		start(uuid: string, entity: Entity, metadata: Metadata) {
			const chunks = metadata.chunks
			if (!chunks || chunks.total <= 0) return

			entity.add(traits.ChunkProgress({ loaded: chunks.chunkSize, total: chunks.total }))
			void pull(uuid, entity, chunks.total, chunks.chunkSize)
		},

		dispose() {
			controller.abort()
		},
	}
}
