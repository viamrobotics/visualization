import type { ResourceStatus } from '@viamrobotics/svelte-sdk'

import { robotApi } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { reconfiguringResources } from '../reconfiguringResources'

interface NameParts {
	namespace?: string
	type?: string
	subtype?: string
	name: string
}

const status = (nameParts: NameParts, state: robotApi.ResourceStatus_State): ResourceStatus =>
	({
		name: { namespace: 'rdk', type: 'component', subtype: 'camera', ...nameParts },
		state,
		error: '',
		revision: '',
	}) as ResourceStatus

const camera = (name: string, state: robotApi.ResourceStatus_State) => status({ name }, state)

const builtinService = (subtype: string, state: robotApi.ResourceStatus_State) =>
	status({ type: 'service', subtype, name: 'builtin' }, state)

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
		expect(reconfiguringResources([camera('camera-1', state)])).toEqual([
			{ key: 'rdk:component:camera:camera-1', name: 'camera-1', state: label },
		])
	})

	it.each([
		['ready', robotApi.ResourceStatus_State.READY],
		['unspecified', robotApi.ResourceStatus_State.UNSPECIFIED],
	])('ignores a %s resource', (_label, state) => {
		expect(reconfiguringResources([camera('camera-1', state)])).toEqual([])
	})

	it('ignores an unhealthy resource, which has settled rather than stalled', () => {
		const resources = [camera('arm-1', robotApi.ResourceStatus_State.UNHEALTHY)]

		expect(reconfiguringResources(resources)).toEqual([])
	})

	it('keeps only the unsettled resources out of a mixed machine', () => {
		const resources = [
			camera('arm-1', robotApi.ResourceStatus_State.READY),
			camera('camera-1', robotApi.ResourceStatus_State.CONFIGURING),
			camera('gantry-1', robotApi.ResourceStatus_State.REMOVING),
		]

		expect(reconfiguringResources(resources).map(({ name }) => name)).toEqual([
			'camera-1',
			'gantry-1',
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

	it('gives two default services distinct keys, since rdk names both of them builtin', () => {
		const resources = [
			builtinService('motion', robotApi.ResourceStatus_State.CONFIGURING),
			builtinService('sensors', robotApi.ResourceStatus_State.CONFIGURING),
		]

		expect(reconfiguringResources(resources).map(({ key }) => key)).toEqual([
			'rdk:service:motion:builtin',
			'rdk:service:sensors:builtin',
		])
	})

	it('separates a component and a service that share a short name', () => {
		const resources = [
			camera('arm-1', robotApi.ResourceStatus_State.CONFIGURING),
			status(
				{ type: 'service', subtype: 'motion', name: 'arm-1' },
				robotApi.ResourceStatus_State.CONFIGURING
			),
		]

		expect(reconfiguringResources(resources).map(({ key }) => key)).toEqual([
			'rdk:component:camera:arm-1',
			'rdk:service:motion:arm-1',
		])
	})

	it('shows a default service by subtype, its own name being builtin on every one', () => {
		const resources = [builtinService('motion', robotApi.ResourceStatus_State.CONFIGURING)]

		expect(reconfiguringResources(resources).map(({ name }) => name)).toEqual(['motion'])
	})

	it('shows a component named builtin by its own name, not by its subtype', () => {
		const resources = [camera('builtin', robotApi.ResourceStatus_State.CONFIGURING)]

		expect(reconfiguringResources(resources).map(({ name }) => name)).toEqual(['builtin'])
	})
})
