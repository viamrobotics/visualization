import { describe, expect, it } from 'vitest'

import { createBinaryPCD } from '$lib/pcd'

import { parsePcdInWorker } from '../index'

const POINT_COUNT = 4096

/** Channels are spread across the byte range so no color-space conversion can merge two groups. */
const GROUP_COUNT = 8
const groupOf = (index: number) => index % GROUP_COUNT

/**
 * Point `i` sits at `[i, i, i]` and carries a color derived only from `i`, so a parsed point
 * still reveals which input it came from — and whether its color travelled with it.
 */
const indexedPcd = async () => {
	const positions = new Float32Array(POINT_COUNT * 3)
	const colors = new Uint8Array(POINT_COUNT * 3)

	for (let i = 0; i < POINT_COUNT; i++) {
		positions[i * 3] = i
		positions[i * 3 + 1] = i
		positions[i * 3 + 2] = i

		const channel = groupOf(i) * 32
		colors[i * 3] = channel
		colors[i * 3 + 1] = channel
		colors[i * 3 + 2] = channel
	}

	const buffer = await createBinaryPCD(positions, colors).arrayBuffer()
	return new Uint8Array(buffer)
}

describe('parsePcdInWorker', () => {
	it('returns every point exactly once', async () => {
		const { positions } = await parsePcdInWorker(await indexedPcd())

		expect(positions).toHaveLength(POINT_COUNT * 3)

		const seen = new Set<number>()
		for (let i = 0; i < POINT_COUNT; i++) {
			const x = positions[i * 3]
			expect(positions[i * 3 + 1]).toBe(x)
			expect(positions[i * 3 + 2]).toBe(x)
			seen.add(x)
		}

		expect(seen.size).toBe(POINT_COUNT)
	})

	it('reorders points so a prefix is not a contiguous slice of scan order', async () => {
		const { positions } = await parsePcdInWorker(await indexedPcd())

		const moved = Array.from({ length: POINT_COUNT }, (_, i) => i).filter(
			(i) => positions[i * 3] !== i
		)

		expect(moved.length).toBeGreaterThan(0)
	})

	it('keeps each point paired with its own color', async () => {
		const { positions, colors } = await parsePcdInWorker(await indexedPcd())

		expect(colors).toBeDefined()

		const channelByGroup = new Map<number, number>()

		for (let i = 0; i < POINT_COUNT; i++) {
			const red = colors![i * 3]

			expect(colors![i * 3 + 1]).toBe(red)
			expect(colors![i * 3 + 2]).toBe(red)

			const group = groupOf(positions[i * 3])
			const known = channelByGroup.get(group)

			if (known === undefined) {
				channelByGroup.set(group, red)
			} else {
				expect(red).toBe(known)
			}
		}

		expect(channelByGroup.size).toBe(GROUP_COUNT)
		expect(new Set(channelByGroup.values()).size).toBe(GROUP_COUNT)
	})

	it('produces the same order for the same bytes, so a decimated cloud holds still', async () => {
		const data = await indexedPcd()

		const first = await parsePcdInWorker(data)
		const second = await parsePcdInWorker(data)

		expect([...second.positions]).toStrictEqual([...first.positions])
	})
})
