import { createWorld, type World } from 'koota'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setIssues } from '../setIssues'
import * as traits from '../traits'

let world: World

beforeEach(() => {
	world = createWorld()
})

afterEach(() => world.destroy())

const UNHEALTHY: traits.IssueLine = { severity: 'warn', message: 'unhealthy' }
const POSE_FAILED: traits.IssueLine = { severity: 'error', message: 'pose failed' }

describe('setIssues', () => {
	it('adds the trait to an entity that has no issues yet', () => {
		const entity = world.spawn()

		setIssues(entity, 'health', [UNHEALTHY])

		expect(entity.get(traits.Issues)?.get('health')).toEqual([UNHEALTHY])
	})

	it('replaces only the lines its key owns', () => {
		const entity = world.spawn()
		setIssues(entity, 'health', [UNHEALTHY])

		setIssues(entity, 'logs', [POSE_FAILED])

		expect([...(entity.get(traits.Issues)?.entries() ?? [])]).toEqual([
			['health', [UNHEALTHY]],
			['logs', [POSE_FAILED]],
		])
	})

	it('drops an emptied key and keeps the others', () => {
		const entity = world.spawn()
		setIssues(entity, 'health', [UNHEALTHY])
		setIssues(entity, 'logs', [POSE_FAILED])

		setIssues(entity, 'health', [])

		expect([...(entity.get(traits.Issues)?.keys() ?? [])]).toEqual(['logs'])
	})

	it('removes the trait with its last key', () => {
		const entity = world.spawn()
		setIssues(entity, 'health', [UNHEALTHY])

		setIssues(entity, 'health', [])

		expect(entity.has(traits.Issues)).toBe(false)
	})

	it('writes nothing for lines equal to what is there', () => {
		const entity = world.spawn()
		setIssues(entity, 'health', [UNHEALTHY])
		const before = entity.get(traits.Issues)

		setIssues(entity, 'health', [{ severity: 'warn', message: 'unhealthy' }])

		expect(entity.get(traits.Issues)).toBe(before)
	})

	it('rewrites a counted line that is equal in text but not the same object', () => {
		const entity = world.spawn()
		setIssues(entity, 'logs', [{ ...POSE_FAILED, count: 1 }])
		const before = entity.get(traits.Issues)

		setIssues(entity, 'logs', [{ ...POSE_FAILED, count: 1 }])

		expect(entity.get(traits.Issues)).not.toBe(before)
	})
})
