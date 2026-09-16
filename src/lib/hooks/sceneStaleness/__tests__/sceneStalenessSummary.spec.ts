import { describe, expect, it } from 'vitest'

import type { PendingInstall } from '../pendingInstalls'
import type { ReconfiguringResource } from '../reconfiguringResources'
import type { SceneFreshness } from '../sceneStalenessReason'

import { sceneStalenessSummary } from '../sceneStalenessSummary'

const freshness = (overrides: Partial<SceneFreshness> = {}): SceneFreshness => ({
	isConnected: true,
	isMachineStarting: false,
	isAwaitingSavedConfig: false,
	isSceneBehindConfig: false,
	installing: [],
	reconfiguring: [],
	...overrides,
})

const install = (name: string): PendingInstall => ({
	name,
	state: 'downloading',
	bytesDownloaded: 0,
	totalBytes: 0,
})

const resource = (
	name: string,
	state: ReconfiguringResource['state'] = 'configuring'
): ReconfiguringResource => ({ name, state })

describe('sceneStalenessSummary', () => {
	it('names the module when exactly one is installing', () => {
		const input = freshness({ installing: [install('viam:realsense')] })

		expect(sceneStalenessSummary('installing', input)).toBe(
			'Updating the scene: installing viam:realsense'
		)
	})

	it('counts rather than lists once more than one is installing', () => {
		const input = freshness({ installing: [install('viam:realsense'), install('viam:ufactory')] })

		expect(sceneStalenessSummary('installing', input)).toBe(
			'Updating the scene: installing 2 modules'
		)
	})

	it('names the resource and its state when exactly one is reconfiguring', () => {
		const input = freshness({ reconfiguring: [resource('camera-1')] })

		expect(sceneStalenessSummary('reconfiguring', input)).toBe(
			'Updating the scene: camera-1 is configuring'
		)
	})

	it('reads out the state a single resource is actually in', () => {
		const input = freshness({ reconfiguring: [resource('camera-1', 'removing')] })

		expect(sceneStalenessSummary('reconfiguring', input)).toBe(
			'Updating the scene: camera-1 is removing'
		)
	})

	it('counts rather than lists once more than one is reconfiguring', () => {
		const input = freshness({ reconfiguring: [resource('camera-1'), resource('arm-1')] })

		expect(sceneStalenessSummary('reconfiguring', input)).toBe(
			'Updating the scene: 2 resources are configuring'
		)
	})

	it('explains a machine still starting up', () => {
		expect(sceneStalenessSummary('starting', freshness({ isMachineStarting: true }))).toBe(
			'Updating the scene: the machine is still starting up'
		)
	})

	it('explains a save the machine has not read yet', () => {
		expect(
			sceneStalenessSummary('awaiting-config', freshness({ isAwaitingSavedConfig: true }))
		).toBe('Updating the scene: the machine has not picked up the saved configuration yet')
	})

	it('explains frames fetched under an older revision', () => {
		expect(sceneStalenessSummary('scene-behind', freshness({ isSceneBehindConfig: true }))).toBe(
			'Updating the scene: the machine was reconfigured'
		)
	})
})
