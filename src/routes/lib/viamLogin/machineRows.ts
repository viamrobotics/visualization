import { appApi } from '@viamrobotics/sdk'

/** One machine in the flat account machine list, with the location it belongs to. */
export interface MachineRow {
	machine: appApi.MachineSummary
	locationName: string
	isOnline: boolean
}

export type MachineSortProperty = 'name' | 'status'
export type SortDirection = 'ascending' | 'descending'

/** Which column the list is sorted by. Ascending status puts online machines first. */
export interface MachineSort {
	property: MachineSortProperty
	direction: SortDirection
}

const byName = (a: MachineRow, b: MachineRow) =>
	a.machine.machineName.localeCompare(b.machine.machineName)

const byStatus = (a: MachineRow, b: MachineRow) => Number(b.isOnline) - Number(a.isOnline)

const PRIMARY_COMPARATORS: Record<MachineSortProperty, (a: MachineRow, b: MachineRow) => number> = {
	name: byName,
	status: byStatus,
}

const compareRows = ({ property, direction }: MachineSort) => {
	const sign = direction === 'ascending' ? 1 : -1
	// Ties within a status group stay in name order whichever way the status column points.
	return (a: MachineRow, b: MachineRow) =>
		sign * PRIMARY_COMPARATORS[property](a, b) || byName(a, b)
}

/**
 * The sort after clicking a column header, as on app.viam.com: the active column flips direction,
 * and a new column starts ascending.
 */
export const nextMachineSort = (sort: MachineSort, property: MachineSortProperty): MachineSort =>
	sort.property === property
		? { property, direction: sort.direction === 'ascending' ? 'descending' : 'ascending' }
		: { property, direction: 'ascending' }

const matchesQuery = (row: MachineRow, query: string) =>
	row.machine.machineName.toLowerCase().includes(query) ||
	row.locationName.toLowerCase().includes(query) ||
	row.machine.partSummaries.some((part) => part.partName.toLowerCase().includes(query))

/**
 * Flattens location summaries into one machine list, filtered by a case-insensitive query on
 * machine, part, or location name. A machine counts as online when any of its parts is.
 */
export const toMachineRows = (
	locations: appApi.LocationSummary[],
	query: string,
	sort: MachineSort
): MachineRow[] => {
	const normalizedQuery = query.trim().toLowerCase()
	return locations
		.flatMap((location) =>
			location.machineSummaries.map((machine) => ({
				machine,
				locationName: location.locationName,
				isOnline: machine.partSummaries.some(
					(part) => part.onlineState === appApi.OnlineState.ONLINE
				),
			}))
		)
		.filter((row) => !normalizedQuery || matchesQuery(row, normalizedQuery))
		.toSorted(compareRows(sort))
}
