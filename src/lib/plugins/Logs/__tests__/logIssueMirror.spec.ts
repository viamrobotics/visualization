import { createWorld, type Entity, type World } from 'koota'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { traits } from '#lib/ecs/index.js'

import type { Log } from '../useLogs.svelte'

import { createLogIssueMirror, type LogIssueMirror } from '../logIssueMirror'

let world: World
let mirror: LogIssueMirror
const counts = new Map<string, number>()

beforeEach(() => {
	world = createWorld()
	counts.clear()
	mirror = createLogIssueMirror(world, (uuid) => counts.get(uuid))
})

afterEach(() => world.destroy())

let nextUuid = 0

const log = (
	message: string,
	level: Log['level'],
	target: { resource?: string; folder?: string }
): Log => ({
	uuid: `${nextUuid++}`,
	message,
	level,
	count: 1,
	timestamp: '',
	...target,
})

const spawnFolder = (id: string): Entity =>
	world.spawn(
		traits.Folder({
			id,
			name: id,
			order: 0,
			sources: [],
			placeholder: undefined,
			pinned: false,
			collapsed: false,
			sceneless: false,
			refreshRate: undefined,
		})
	)

const logLines = (entity: Entity) =>
	entity
		.get(traits.Issues)
		?.get('logs')
		?.map(({ severity, message }) => ({ severity, message }))

describe('createLogIssueMirror', () => {
	it('marks the frame a line names with its warn and error lines, leaving info out', () => {
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)

		mirror.apply([
			log('Fetching pose for arm...', 'info', { resource: 'arm' }),
			log('Pose is stale', 'warn', { resource: 'arm' }),
			log('Pose request failed', 'error', { resource: 'arm' }),
		])

		expect(logLines(arm)).toEqual([
			{ severity: 'warn', message: 'Pose is stale' },
			{ severity: 'error', message: 'Pose request failed' },
		])
	})

	it('marks both rows a line names, from the one line', () => {
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)
		const frames = spawnFolder('frames')

		mirror.apply([log('Error fetching pose', 'error', { resource: 'arm', folder: 'frames' })])

		expect(logLines(arm)).toEqual([{ severity: 'error', message: 'Error fetching pose' }])
		expect(logLines(frames)).toEqual([{ severity: 'error', message: 'Error fetching pose' }])
	})

	it('marks a frameless component the same as a frame', () => {
		const base = world.spawn(traits.Name('base'), traits.FramelessComponent)

		mirror.apply([log('Unreachable', 'warn', { resource: 'base' })])

		expect(logLines(base)).toEqual([{ severity: 'warn', message: 'Unreachable' }])
	})

	it('leaves a drawn entity alone when it shares the resource’s name', () => {
		const drawn = world.spawn(traits.Name('arm'), traits.DrawAPI)

		mirror.apply([log('Pose request failed', 'error', { resource: 'arm' })])

		expect(drawn.has(traits.Issues)).toBe(false)
	})

	it('keeps a folder id from colliding with a resource of the same name', () => {
		const resource = world.spawn(traits.Name('drawn'), traits.FramesAPI)
		const folder = spawnFolder('drawn')

		mirror.apply([log('Draw server error', 'error', { folder: 'drawn' })])

		expect(logLines(folder)).toEqual([{ severity: 'error', message: 'Draw server error' }])
		expect(resource.has(traits.Issues)).toBe(false)
	})

	it('clears a row once its lines are gone from the log', () => {
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)
		mirror.apply([log('Pose request failed', 'error', { resource: 'arm' })])

		mirror.apply([])

		expect(arm.has(traits.Issues)).toBe(false)
	})

	it('leaves another writer’s issues on a row it clears', () => {
		const arm = world.spawn(
			traits.Name('arm'),
			traits.FramesAPI,
			traits.Issues(new Map([['health', [{ severity: 'warn', message: 'unhealthy' }]]]))
		)
		mirror.apply([log('Pose request failed', 'error', { resource: 'arm' })])

		mirror.apply([])

		expect([...(arm.get(traits.Issues)?.keys() ?? [])]).toEqual(['health'])
	})

	it('marks a row spawned after its line was logged on the next apply', () => {
		const logs = [log('Pose request failed', 'error', { resource: 'arm' })]
		mirror.apply(logs)
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)

		mirror.apply(logs)

		expect(logLines(arm)).toEqual([{ severity: 'error', message: 'Pose request failed' }])
	})

	it('keeps a repeated line’s identity, so a repeat rewrites nothing', () => {
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)
		const line = log('Pose request failed', 'error', { resource: 'arm' })
		mirror.apply([line])
		const before = arm.get(traits.Issues)

		mirror.apply([{ ...line, count: 2 }])

		expect(arm.get(traits.Issues)).toBe(before)
	})

	it('reads a line’s count live from the source it was given', () => {
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)
		const line = log('Pose request failed', 'error', { resource: 'arm' })
		mirror.apply([line])

		counts.set(line.uuid, 7)

		expect(arm.get(traits.Issues)?.get('logs')?.[0]?.count).toBe(7)
	})

	it('takes every line it wrote back off on clear', () => {
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI)
		const frames = spawnFolder('frames')
		mirror.apply([log('Error fetching pose', 'error', { resource: 'arm', folder: 'frames' })])

		mirror.clear()

		expect(arm.has(traits.Issues)).toBe(false)
		expect(frames.has(traits.Issues)).toBe(false)
	})
})
