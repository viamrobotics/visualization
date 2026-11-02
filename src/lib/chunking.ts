import type { Entity, World } from 'koota'

import { writeBufferGeometryRange } from '$lib/attribute'
import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
import { traits } from '$lib/ecs'
import { type Metadata } from '$lib/metadata'

/**
 * One chunk of an entity's point cloud. Chunking covers point-cloud positions with
 * metadata colors and opacities, and no other entity type.
 */
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
	// Each running pull, by uuid, with the controller that stops only it.
	const active = new Map<string, AbortController>()
	// Pulls that stopped before their last chunk, by the offset they reached.
	const suspended = new Map<string, { entity: Entity; total: number; start: number }>()
	const controller = new AbortController()

	const pull = async (uuid: string, entity: Entity, total: number, firstChunkEnd: number) => {
		if (active.has(uuid)) return
		const pullController = new AbortController()
		active.set(uuid, pullController)

		const signal = AbortSignal.any([controller.signal, pullController.signal])
		let nextStart = firstChunkEnd
		let isSuspended = false

		const suspend = () => {
			suspended.set(uuid, { entity, total, start: nextStart })
			isSuspended = true
		}

		try {
			while (!signal.aborted) {
				const chunk = await fetchChunk(uuid, nextStart, signal)
				if (signal.aborted) break

				// No chunk means the fetcher has no live client, not that the server is
				// out of points.
				if (!chunk) {
					suspend()
					break
				}

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
				// A connection dropping rejects the in-flight fetch, so park the offset
				// rather than abandon the points already written.
				suspend()
				console.error(`Chunk pull failed for entity ${uuid}:`, error)
			}
		} finally {
			// A stopped pull's uuid may already belong to a newer pull.
			if (active.get(uuid) === pullController) active.delete(uuid)
			// A suspended pull keeps its progress, which `resume` reports against.
			if (!isSuspended && world.has(entity)) {
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

		/**
		 * Restarts every pull that stopped short, each from the offset it reached.
		 * Call when a connection is back: a pull that ran out of client mid-stream
		 * would otherwise leave its point cloud permanently half-written.
		 */
		resume() {
			const parked = [...suspended]
			suspended.clear()

			for (const [uuid, { entity, total, start }] of parked) {
				if (!world.has(entity)) continue
				void pull(uuid, entity, total, start)
			}
		},

		/**
		 * Abandons the pull for `uuid`, running or suspended. Call when its entity is
		 * destroyed, so a later `start` under the same uuid pulls for the new entity.
		 */
		stop(uuid: string) {
			active.get(uuid)?.abort()
			active.delete(uuid)

			// A running pull clears its progress on the way out. A parked one has no way out.
			const parked = suspended.get(uuid)
			suspended.delete(uuid)
			if (parked && world.has(parked.entity)) parked.entity.remove(traits.ChunkProgress)
		},

		dispose() {
			suspended.clear()
			controller.abort()
		},
	}
}
