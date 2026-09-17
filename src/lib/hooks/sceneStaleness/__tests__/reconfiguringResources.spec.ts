import type { ResourceStatus } from '@viamrobotics/svelte-sdk'

import { robotApi } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { reconfiguringResources } from '../reconfiguringResources'

const status = (name: string, state: robotApi.ResourceStatus_State): ResourceStatus =>
	({
		name: { namespace: 'rdk', type: 'component', subtype: 'camera', name },
		state,
		error: '',
		revision: '',
	}) as ResourceStatus

describe('reconfiguringResources', () => {
	it('reports nothing for a machine with no resources', () => {
		expect(reconfiguringResources()).toEqual([])
		expect(reconfiguringResources([])).toEqual([])
	})

	it.each([
		['unconfigured', robotApi.ResourceStatus_State.UNCONFIGURED],
		['configuring', robotApi.ResourceStatus_State.CONFIGURING],
		['removing', robotApi.ResourceStatus_State.REMOVING],
	])('reports a %s resource with that state as its label', (label, state) => {
		expect(reconfiguringResources([status('camera-1', state)])).toEqual([
			{ name: 'camera-1', state: label },
		])
	})

	it.each([
		['ready', robotApi.ResourceStatus_State.READY],
		['unspecified', robotApi.ResourceStatus_State.UNSPECIFIED],
	])('ignores a %s resource', (_label, state) => {
		expect(reconfiguringResources([status('camera-1', state)])).toEqual([])
	})

	it('ignores an unhealthy resource, which has settled rather than stalled', () => {
		const resources = [status('arm-1', robotApi.ResourceStatus_State.UNHEALTHY)]

		expect(reconfiguringResources(resources)).toEqual([])
	})

	it('keeps only the unsettled resources out of a mixed machine', () => {
		const resources = [
			status('arm-1', robotApi.ResourceStatus_State.READY),
			status('camera-1', robotApi.ResourceStatus_State.CONFIGURING),
			status('gantry-1', robotApi.ResourceStatus_State.REMOVING),
		]

		expect(reconfiguringResources(resources)).toEqual([
			{ name: 'camera-1', state: 'configuring' },
			{ name: 'gantry-1', state: 'removing' },
		])
	})

	it('ignores a status with no resource name', () => {
		const resources = [
			{
				state: robotApi.ResourceStatus_State.CONFIGURING,
				error: '',
				revision: '',
			} as ResourceStatus,
		]

		expect(reconfiguringResources(resources)).toEqual([])
	})

	it('ignores an rdk-internal service, which the scene never draws', () => {
		const resources = [
			{
				name: { namespace: 'rdk-internal', type: 'service', subtype: 'web', name: 'builtin' },
				state: robotApi.ResourceStatus_State.CONFIGURING,
				error: '',
				revision: '',
			} as ResourceStatus,
		]

		expect(reconfiguringResources(resources)).toEqual([])
	})

	it('ignores the entry for a remote machine itself', () => {
		const resources = [
			{
				name: { namespace: 'rdk', type: 'remote', subtype: '', name: 'my-remote' },
				state: robotApi.ResourceStatus_State.CONFIGURING,
				error: '',
				revision: '',
			} as ResourceStatus,
		]

		expect(reconfiguringResources(resources)).toEqual([])
	})

	it('keeps a resource on a remote, which is named with the remote prefix', () => {
		const resources = [
			{
				name: {
					namespace: 'rdk',
					type: 'component',
					subtype: 'camera',
					name: 'my-remote:camera-1',
				},
				state: robotApi.ResourceStatus_State.CONFIGURING,
				error: '',
				revision: '',
			} as ResourceStatus,
		]

		expect(reconfiguringResources(resources)).toEqual([
			{ name: 'my-remote:camera-1', state: 'configuring' },
		])
	})
})
