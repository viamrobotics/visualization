import { describe, expect, it } from 'vitest'

import { type SceneFreshness, sceneStalenessReason } from '../sceneStalenessReason'

const freshness = (overrides: Partial<SceneFreshness> = {}): SceneFreshness => ({
	isConnected: true,
	isMachineStarting: false,
	isAwaitingSavedConfig: false,
	isSceneBehindConfig: false,
	installing: [],
	reconfiguring: [],
	...overrides,
})

const install = {
	name: 'viam:realsense',
	state: 'downloading',
	bytesDownloaded: 0,
	totalBytes: 0,
} as const
const resource = { name: 'camera-1', state: 'configuring' } as const

describe('sceneStalenessReason', () => {
	it('reports nothing for a settled machine', () => {
		expect(sceneStalenessReason(freshness())).toBeUndefined()
	})

	it('reports nothing while the machine is unreachable, which is absence rather than an update', () => {
		const disconnected = freshness({
			isConnected: false,
			installing: [install],
			reconfiguring: [resource],
			isMachineStarting: true,
			isAwaitingSavedConfig: true,
			isSceneBehindConfig: true,
		})

		expect(sceneStalenessReason(disconnected)).toBeUndefined()
	})

	it('reports an install', () => {
		expect(sceneStalenessReason(freshness({ installing: [install] }))).toBe('installing')
	})

	it('reports a reconfigure', () => {
		expect(sceneStalenessReason(freshness({ reconfiguring: [resource] }))).toBe('reconfiguring')
	})

	it('reports a machine still starting up', () => {
		expect(sceneStalenessReason(freshness({ isMachineStarting: true }))).toBe('starting')
	})

	it('reports a save the machine has not read yet', () => {
		expect(sceneStalenessReason(freshness({ isAwaitingSavedConfig: true }))).toBe('awaiting-config')
	})

	it('reports frames fetched under an older revision', () => {
		expect(sceneStalenessReason(freshness({ isSceneBehindConfig: true }))).toBe('scene-behind')
	})

	it('prefers the install over the reconfigure it is holding up', () => {
		const both = freshness({ installing: [install], reconfiguring: [resource] })

		expect(sceneStalenessReason(both)).toBe('installing')
	})

	it('prefers the named resource over the revision that moved because of it', () => {
		const both = freshness({ reconfiguring: [resource], isSceneBehindConfig: true })

		expect(sceneStalenessReason(both)).toBe('reconfiguring')
	})

	it('prefers a machine starting up over a save it has not read', () => {
		const both = freshness({ isMachineStarting: true, isAwaitingSavedConfig: true })

		expect(sceneStalenessReason(both)).toBe('starting')
	})
})
