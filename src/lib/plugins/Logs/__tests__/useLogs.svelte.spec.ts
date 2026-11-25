import { describe, expect, it } from 'vitest'

import { provideLogs } from '../useLogs.svelte'

const ARM = { resource: 'arm' }
const GRIPPER = { resource: 'gripper' }
const FRAMES = { folder: 'frames' }
const POINTCLOUDS = { folder: 'pointclouds' }
const CAMERA_POINTCLOUDS = { resource: 'camera', folder: 'pointclouds' }
const ARM_FRAMES = { resource: 'arm', folder: 'frames' }
const CAMERA_SOURCE = 'camera-producer'
const OTHER_SOURCE = 'other-producer'

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

	it('orders newest first and keeps a repeating line where it first appeared', () => {
		const logs = provideLogs()

		logs.add('first')
		logs.add('second')
		logs.add('first')

		expect(logs.current.map((log) => log.message)).toEqual(['second', 'first'])
	})

	it('keeps evicting by latest repeat, so a line still firing outlives quieter ones', () => {
		const logs = provideLogs()

		logs.add('repeating')
		for (let index = 0; index < 199; index += 1) logs.add(`filler ${index}`)
		logs.add('repeating')
		logs.add('one more')

		expect(logs.current.map((log) => log.message)).toContain('repeating')
		expect(logs.current.map((log) => log.message)).not.toContain('filler 0')
	})

	it('keeps one entry for a line naming both a resource and a folder', () => {
		const logs = provideLogs()

		logs.add('Error fetching pose for arm', 'error', { resource: 'arm', folder: 'frames' })

		expect(logs.current).toMatchObject([{ resource: 'arm', folder: 'frames' }])
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

	it('takes a retracted line off the trigger badge count', () => {
		const logs = provideLogs()
		logs.add('Pose request failed', 'error', ARM)
		logs.add('Pose is stale', 'warn', ARM)

		logs.retract('Pose request failed', 'error', ARM)

		expect(logs.errorCount).toBe(0)
		expect(logs.warnCount).toBe(1)
	})

	it('takes every line of a retracted source off the trigger badge count', () => {
		const logs = provideLogs()
		logs.add('Pose request failed', 'error', CAMERA_POINTCLOUDS, CAMERA_SOURCE)
		logs.add('Pose is stale', 'warn', CAMERA_POINTCLOUDS, CAMERA_SOURCE)
		logs.add('Unrelated', 'warn', GRIPPER, OTHER_SOURCE)

		logs.retractSource(CAMERA_SOURCE)

		expect(logs.errorCount).toBe(0)
		expect(logs.warnCount).toBe(1)
	})

	it('drops the matching line on retract', () => {
		const logs = provideLogs()
		logs.add('arm has no frame', 'warn', ARM)
		logs.add('Fetching pose for arm...', 'info', ARM)

		logs.retract('arm has no frame', 'warn', ARM)

		expect(logs.current.map((log) => log.message)).toEqual(['Fetching pose for arm...'])
	})

	it('leaves a line alone when retracting the same message at another level', () => {
		const logs = provideLogs()
		logs.add('Unreachable', 'error', ARM)

		logs.retract('Unreachable', 'warn', ARM)

		expect(logs.current).toMatchObject([{ message: 'Unreachable', level: 'error' }])
	})

	it('re-counts a retracted line from one when it is added again', () => {
		const logs = provideLogs()
		logs.add('arm has no frame', 'warn', ARM)
		logs.add('arm has no frame', 'warn', ARM)
		logs.retract('arm has no frame', 'warn', ARM)

		logs.add('arm has no frame', 'warn', ARM)

		expect(logs.current[0]).toMatchObject({ message: 'arm has no frame', count: 1 })
	})

	it('drops every line a source filed on retractSource, whatever its rows', () => {
		const logs = provideLogs()
		logs.add('Error fetching pointcloud', 'error', CAMERA_POINTCLOUDS, CAMERA_SOURCE)
		logs.add('camera has no frame', 'warn', { resource: 'camera' }, CAMERA_SOURCE)
		logs.add('Fetching pointclouds...', 'info', POINTCLOUDS, CAMERA_SOURCE)

		logs.retractSource(CAMERA_SOURCE)

		expect(logs.current).toEqual([])
	})

	it('keeps another source’s identical line about the same rows on retractSource', () => {
		const logs = provideLogs()
		logs.add('Error fetching pose for arm', 'error', ARM_FRAMES, CAMERA_SOURCE)
		logs.add('Error fetching pose for arm', 'error', ARM_FRAMES, OTHER_SOURCE)

		logs.retractSource(CAMERA_SOURCE)

		expect(logs.current).toMatchObject([
			{ message: 'Error fetching pose for arm', source: OTHER_SOURCE, count: 1 },
		])
	})

	it('drops every line and badge count on clear', () => {
		const logs = provideLogs()

		logs.add('Pose request failed', 'error', { resource: 'arm', folder: 'frames' })
		logs.add('Pose is stale', 'warn', GRIPPER)

		logs.clear()

		expect(logs.current).toEqual([])
		expect(logs.errorCount).toBe(0)
		expect(logs.warnCount).toBe(0)
	})

	it('re-counts a line added after a clear rather than resuming its old count', () => {
		const logs = provideLogs()

		logs.add('Pose request failed', 'error', ARM)
		logs.add('Pose request failed', 'error', ARM)
		logs.clear()

		logs.add('Pose request failed', 'error', ARM)

		expect(logs.current).toMatchObject([{ message: 'Pose request failed', count: 1 }])
	})

	it('takes an aged-out line off the trigger badge count', () => {
		const logs = provideLogs()
		logs.add('Pose request failed', 'error', { resource: 'arm', folder: 'frames' })

		for (let index = 0; index < 200; index += 1) logs.add(`filler ${index}`)

		expect(logs.errorCount, 'the store holds 200 distinct lines').toBe(0)
	})
})
