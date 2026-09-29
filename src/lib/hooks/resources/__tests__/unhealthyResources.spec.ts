import type { ResourceStatus } from '@viamrobotics/svelte-sdk'

import { robotApi } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { unhealthyResources } from '../unhealthyResources'

const status = (name: string, state: robotApi.ResourceStatus_State, error = ''): ResourceStatus =>
	({
		name: { namespace: 'rdk', type: 'component', subtype: 'arm', name },
		state,
		error,
		revision: '',
	}) as ResourceStatus

describe('unhealthyResources', () => {
	it('reports nothing for a machine with no resources', () => {
		expect(unhealthyResources()).toEqual([])
		expect(unhealthyResources([])).toEqual([])
	})

	it.each([
		['ready', robotApi.ResourceStatus_State.READY],
		['configuring', robotApi.ResourceStatus_State.CONFIGURING],
		['unconfigured', robotApi.ResourceStatus_State.UNCONFIGURED],
		['removing', robotApi.ResourceStatus_State.REMOVING],
		['unspecified', robotApi.ResourceStatus_State.UNSPECIFIED],
	])('ignores a %s resource', (_label, state) => {
		expect(unhealthyResources([status('arm-1', state)])).toEqual([])
	})

	it('carries the machine-reported error for each unhealthy resource', () => {
		const resources = [
			status('arm-1', robotApi.ResourceStatus_State.UNHEALTHY, 'joint 3 not responding'),
			status('arm-2', robotApi.ResourceStatus_State.READY),
			status('gantry-1', robotApi.ResourceStatus_State.UNHEALTHY, 'homing failed'),
		]

		expect(unhealthyResources(resources)).toEqual([
			{ name: 'arm-1', error: 'joint 3 not responding' },
			{ name: 'gantry-1', error: 'homing failed' },
		])
	})

	it('trims the whitespace RDK wraps around some errors', () => {
		const resources = [
			status('arm-1', robotApi.ResourceStatus_State.UNHEALTHY, '  rpc error: unavailable\n'),
		]

		expect(unhealthyResources(resources)).toEqual([
			{ name: 'arm-1', error: 'rpc error: unavailable' },
		])
	})

	it('still names a resource whose ResourceName is absent', () => {
		const resources = [
			{
				state: robotApi.ResourceStatus_State.UNHEALTHY,
				error: 'built without a name',
				revision: '',
			} as ResourceStatus,
		]

		expect(unhealthyResources(resources)).toEqual([
			{ name: 'unknown resource', error: 'built without a name' },
		])
	})
})
