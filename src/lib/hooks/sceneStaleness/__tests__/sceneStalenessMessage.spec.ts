import { describe, expect, it } from 'vitest'

import type { PendingInstall } from '../pendingInstalls'
import type { ReconfiguringResource } from '../reconfiguringResources'
import type { SceneFreshness, SceneStalenessReason } from '../sceneStalenessReason'

import { sceneStalenessMessage } from '../sceneStalenessMessage'

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
): ReconfiguringResource => ({ key: `rdk:component:camera:${name}`, name, state })

const EVERY_REASON: SceneStalenessReason[] = [
	'installing',
	'reconfiguring',
	'starting',
	'awaiting-config',
	'scene-behind',
]

describe('sceneStalenessMessage', () => {
	it.each(EVERY_REASON)('labels %s with an action, to agree with the spinner', (reason) => {
		expect(sceneStalenessMessage(reason, freshness()).label).toMatch(/ing$/)
	})

	it('labels an install rather than calling it a scene update', () => {
		expect(sceneStalenessMessage('installing', freshness()).label).toBe('Installing')
	})

	it('names the module when exactly one is installing', () => {
		const input = freshness({ installing: [install('viam:realsense')] })

		expect(sceneStalenessMessage('installing', input).summary).toBe('Installing viam:realsense')
	})

	it('counts rather than lists once more than one is installing', () => {
		const input = freshness({ installing: [install('viam:realsense'), install('viam:ufactory')] })

		expect(sceneStalenessMessage('installing', input).summary).toBe('Installing 2 modules')
	})

	it('labels a reconfigure', () => {
		expect(sceneStalenessMessage('reconfiguring', freshness()).label).toBe('Configuring')
	})

	it('names the resource and its state when exactly one is reconfiguring', () => {
		const input = freshness({ reconfiguring: [resource('camera-1')] })

		expect(sceneStalenessMessage('reconfiguring', input).summary).toBe('camera-1 is configuring')
	})

	it('reads out the state a single resource is actually in', () => {
		const input = freshness({ reconfiguring: [resource('camera-1', 'removing')] })

		expect(sceneStalenessMessage('reconfiguring', input).summary).toBe('camera-1 is removing')
	})

	it('counts rather than lists once more than one is reconfiguring', () => {
		const input = freshness({ reconfiguring: [resource('camera-1'), resource('arm-1')] })

		expect(sceneStalenessMessage('reconfiguring', input).summary).toBe(
			'2 resources are configuring'
		)
	})

	it('labels a machine still starting up', () => {
		expect(sceneStalenessMessage('starting', freshness()).label).toBe('Starting')
	})

	it('explains a machine still starting up', () => {
		expect(sceneStalenessMessage('starting', freshness()).summary).toBe(
			'The machine is still starting up'
		)
	})

	it('labels a save the machine has not read yet as applying', () => {
		expect(sceneStalenessMessage('awaiting-config', freshness()).label).toBe('Applying')
	})

	it('explains a save the machine has not read yet without contradicting that label', () => {
		expect(sceneStalenessMessage('awaiting-config', freshness()).summary).toBe(
			'Waiting for the machine to pick up the saved configuration'
		)
	})

	it('reserves the updating label for the scene actually redrawing', () => {
		expect(sceneStalenessMessage('scene-behind', freshness()).label).toBe('Updating')
	})

	it('explains frames fetched under an older revision', () => {
		expect(sceneStalenessMessage('scene-behind', freshness()).summary).toBe(
			"Redrawing from the machine's new configuration"
		)
	})
})
