// CLAUDE-DEBUG: temporary repro for chunk-stops-at-first, deleted at cleanup
import { createWorld } from 'koota'
import { describe, expect, it, vi } from 'vitest'

vi.mock('#lib/loaders/pcd/index.js', () => ({
	parsePcdInWorker: vi.fn(),
}))

import { Geometry, Transform } from '#lib/buf/common/v1/common_pb.js'
import { createChunkLoader, type EntityChunk } from '#lib/chunking.js'
import { traits } from '#lib/ecs/index.js'
import { parsePcdInWorker } from '#lib/loaders/pcd/index.js'
import { metadataFromStruct } from '#lib/metadata.js'

import { drawTransform } from '../draw'

const TOTAL = 6
const CHUNK_SIZE = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const chunkedTransform = () =>
	new Transform({
		referenceFrame: 'chunked-cloud',
		physicalObject: new Geometry({
			geometryType: { case: 'pointcloud', value: { pointCloud: new Uint8Array(1) } },
		}),
		metadata: {
			fields: {
				chunks: {
					kind: {
						case: 'structValue',
						value: {
							fields: {
								chunk_size: { kind: { case: 'numberValue', value: CHUNK_SIZE } },
								total: { kind: { case: 'numberValue', value: TOTAL } },
								stride: { kind: { case: 'numberValue', value: 12 } },
							},
						},
					},
				},
			},
		},
	})

const run = async (parseDelayMs: number, fetchDelayMs: number) => {
	vi.mocked(parsePcdInWorker).mockImplementation(async () => {
		await sleep(parseDelayMs)
		return {
			id: 0,
			positions: new Float32Array(CHUNK_SIZE * 3),
			colors: undefined,
			bounds: undefined,
			boundsTree: undefined,
			shuffled: 0,
		} as never
	})
	const world = createWorld()
	const transform = chunkedTransform()
	const { entity } = drawTransform(world, transform, traits.WorldStateStoreAPI, { removable: false })
	const loader = createChunkLoader({
		world,
		invalidate: () => {},
		fetchChunk: async (_uuid, start): Promise<EntityChunk> => {
			await sleep(fetchDelayMs)
			return { start, positions: new Float32Array((TOTAL - start) * 3).fill(1), done: true }
		},
	})

	loader.start('cloud', entity, metadataFromStruct(transform.metadata?.fields))
	await sleep(parseDelayMs + fetchDelayMs + 50)

	const result = {
		drawn: entity.get(traits.BufferGeometry)?.drawRange.count,
		hasProgress: entity.has(traits.ChunkProgress),
	}
	console.log('CLAUDE-DEBUG', JSON.stringify({ at: 'result', parseDelayMs, fetchDelayMs, ...result }))
	world.destroy()
	return result
}

describe('CLAUDE-DEBUG chunk race', () => {
	it('fetch resolves before the worker parse lands', async () => {
		expect(await run(30, 5)).toStrictEqual({ drawn: TOTAL, hasProgress: false })
	})

	it('worker parse lands before the fetch resolves', async () => {
		expect(await run(5, 30)).toStrictEqual({ drawn: TOTAL, hasProgress: false })
	})
})
