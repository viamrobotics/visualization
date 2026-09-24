import { describe, expect, it } from 'vitest'

import { provideLogs } from '../useLogs.svelte'

const ARM = { resource: 'arm' }
const GRIPPER = { resource: 'gripper' }
const FRAMES = { folder: 'frames' }

describe('provideLogs', () => {
	it('collapses a repeated line into one entry with a count', () => {
		const logs = provideLogs()

		logs.add('Fetching pose for arm...', 'info', ARM)
		logs.add('Fetching pose for arm...', 'info', ARM)
		logs.add('Fetching pose for arm...', 'info', ARM)

		expect(logs.current).toHaveLength(1)
		expect(logs.current[0]).toMatchObject({ message: 'Fetching pose for arm...', count: 3 })
	})

	it('keeps lines apart by level, target, and message', () => {
		const logs = provideLogs()

		logs.add('Unreachable', 'warn', ARM)
		logs.add('Unreachable', 'error', ARM)
		logs.add('Unreachable', 'warn', GRIPPER)
		logs.add('Unreachable', 'warn', FRAMES)
		logs.add('Unreachable', 'warn')

		expect(logs.current).toHaveLength(5)
	})

	it('orders newest first and lifts a repeating line back to the top', () => {
		const logs = provideLogs()

		logs.add('first')
		logs.add('second')
		logs.add('first')

		expect(logs.current.map((log) => log.message)).toEqual(['first', 'second'])
	})

	it('reports the worst level logged against a resource', () => {
		const logs = provideLogs()

		expect(logs.statusFor(ARM)).toBeUndefined()

		logs.add('Fetching pose for arm...', 'info', ARM)
		expect(logs.statusFor(ARM)).toBeUndefined()

		logs.add('Pose is stale', 'warn', ARM)
		expect(logs.statusFor(ARM)).toBe('warn')

		logs.add('Pose request failed', 'error', ARM)
		expect(logs.statusFor(ARM)).toBe('error')
	})

	it('marks both rows a line names, from the one entry', () => {
		const logs = provideLogs()

		logs.add('Error fetching pose for arm', 'error', { resource: 'arm', folder: 'frames' })

		expect(logs.current).toHaveLength(1)
		expect(logs.statusFor(ARM)).toBe('error')
		expect(logs.statusFor(FRAMES)).toBe('error')
	})

	it('does not mark a row from a line filed against another one', () => {
		const logs = provideLogs()

		logs.add('Pose request failed', 'error', ARM)

		expect(logs.statusFor(GRIPPER)).toBeUndefined()
		expect(logs.statusFor({ folder: 'frames' })).toBeUndefined()
		expect(logs.statusFor({})).toBeUndefined()
	})

	it('keeps a folder id from colliding with a resource of the same name', () => {
		const logs = provideLogs()

		logs.add('Draw server error', 'error', { folder: 'drawn' })

		expect(logs.statusFor({ folder: 'drawn' })).toBe('error')
		expect(logs.statusFor({ resource: 'drawn' })).toBeUndefined()
	})

	it('returns a row its own lines, newest first', () => {
		const logs = provideLogs()

		logs.add('Pose request failed', 'error', ARM)
		logs.add('Unrelated', 'error', GRIPPER)
		logs.add('Pose is stale', 'warn', ARM)
		logs.add('Pose is stale', 'warn', ARM)

		expect(logs.linesFor(ARM)).toMatchObject([
			{ message: 'Pose is stale', count: 2 },
			{ message: 'Pose request failed', count: 1 },
		])
	})

	it('counts distinct lines per level for the trigger badge', () => {
		const logs = provideLogs()

		logs.add('Pose request failed', 'error', ARM)
		logs.add('Pose request failed', 'error', ARM)
		logs.add('Pose is stale', 'warn', ARM)
		logs.add('Fetching', 'info', ARM)

		expect(logs.errorCount).toBe(1)
		expect(logs.warnCount).toBe(1)
	})

	it('drops every line and row alert on clear', () => {
		const logs = provideLogs()

		logs.add('Pose request failed', 'error', { resource: 'arm', folder: 'frames' })
		logs.add('Pose is stale', 'warn', GRIPPER)

		logs.clear()

		expect(logs.current).toEqual([])
		expect(logs.errorCount).toBe(0)
		expect(logs.warnCount).toBe(0)
		expect(logs.statusFor(ARM)).toBeUndefined()
		expect(logs.statusFor(FRAMES)).toBeUndefined()
		expect(logs.statusFor(GRIPPER)).toBeUndefined()
		expect(logs.linesFor(ARM)).toEqual([])
	})

	it('re-counts a line added after a clear rather than resuming its old count', () => {
		const logs = provideLogs()

		logs.add('Pose request failed', 'error', ARM)
		logs.add('Pose request failed', 'error', ARM)
		logs.clear()

		logs.add('Pose request failed', 'error', ARM)

		expect(logs.current).toMatchObject([{ message: 'Pose request failed', count: 1 }])
	})

	it('clears every row a line marked once it ages out', () => {
		const logs = provideLogs()

		logs.add('Pose request failed', 'error', { resource: 'arm', folder: 'frames' })
		expect(logs.statusFor(ARM)).toBe('error')
		expect(logs.statusFor(FRAMES)).toBe('error')

		// The store holds 200 distinct lines, so 200 more push the first one out.
		for (let index = 0; index < 200; index += 1) logs.add(`filler ${index}`)

		expect(logs.statusFor(ARM)).toBeUndefined()
		expect(logs.statusFor(FRAMES)).toBeUndefined()
		expect(logs.errorCount).toBe(0)
	})
})
