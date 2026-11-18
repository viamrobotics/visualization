import { appApi } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { toMachineRows } from '../machineRows'

const machine = (machineName: string, onlineStates: appApi.OnlineState[]) =>
	new appApi.MachineSummary({
		machineId: machineName,
		machineName,
		partSummaries: onlineStates.map(
			(onlineState, index) =>
				new appApi.PartSummary({
					partId: `${machineName}-${index}`,
					partName: `part-${index}`,
					onlineState,
				})
		),
	})

const { ONLINE, OFFLINE } = appApi.OnlineState

const locations = [
	new appApi.LocationSummary({
		locationName: 'Remote',
		machineSummaries: [machine('zeta', [OFFLINE]), machine('alpha', [OFFLINE, ONLINE])],
	}),
	new appApi.LocationSummary({
		locationName: 'Lab',
		machineSummaries: [machine('beta', [OFFLINE]), machine('gamma', [ONLINE])],
	}),
]

const names = (sortKey: Parameters<typeof toMachineRows>[2], query = '') =>
	toMachineRows(locations, query, sortKey).map((row) => row.machine.machineName)

describe('toMachineRows', () => {
	it('sorts online machines first by status, counting a machine with any online part', () => {
		expect(names('status')).toEqual(['alpha', 'gamma', 'beta', 'zeta'])
	})

	it('sorts by name across locations', () => {
		expect(names('name')).toEqual(['alpha', 'beta', 'gamma', 'zeta'])
	})

	it('sorts by location, then online first within a location', () => {
		expect(names('location')).toEqual(['gamma', 'beta', 'alpha', 'zeta'])
	})

	it('filters on the location name as well as machine names', () => {
		expect(names('name', 'lab')).toEqual(['beta', 'gamma'])
	})
})
