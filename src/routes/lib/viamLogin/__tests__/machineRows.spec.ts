import { appApi } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { type MachineSort, nextMachineSort, toMachineRows } from '../machineRows'

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

const names = (sort: MachineSort, query = '', favoritesFirst: ReadonlySet<string> | null = null) =>
	toMachineRows(locations, query, sort, favoritesFirst).map((row) => row.machine.machineName)

describe('toMachineRows', () => {
	it('sorts online machines first by status, counting a machine with any online part', () => {
		expect(names({ property: 'status', direction: 'ascending' })).toEqual([
			'alpha',
			'gamma',
			'beta',
			'zeta',
		])
	})

	it('puts offline machines first when status is descending, still in name order', () => {
		expect(names({ property: 'status', direction: 'descending' })).toEqual([
			'beta',
			'zeta',
			'alpha',
			'gamma',
		])
	})

	it('sorts by name across locations, in either direction', () => {
		expect(names({ property: 'name', direction: 'descending' })).toEqual([
			'zeta',
			'gamma',
			'beta',
			'alpha',
		])
	})

	it('filters on the location name as well as machine names', () => {
		expect(names({ property: 'name', direction: 'ascending' }, 'lab')).toEqual(['beta', 'gamma'])
	})

	it('lifts favorites above the rest, keeping the column sort within each group', () => {
		expect(
			names({ property: 'name', direction: 'ascending' }, '', new Set(['zeta', 'beta']))
		).toEqual(['beta', 'zeta', 'alpha', 'gamma'])
	})
})

describe('nextMachineSort', () => {
	it('flips the direction when the active column is clicked again', () => {
		expect(nextMachineSort({ property: 'name', direction: 'ascending' }, 'name')).toEqual({
			property: 'name',
			direction: 'descending',
		})
	})

	it('starts a newly clicked column ascending', () => {
		expect(nextMachineSort({ property: 'name', direction: 'descending' }, 'status')).toEqual({
			property: 'status',
			direction: 'ascending',
		})
	})
})
