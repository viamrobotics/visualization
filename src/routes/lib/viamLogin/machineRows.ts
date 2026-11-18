import { appApi } from '@viamrobotics/sdk'

/** One machine in the flat account machine list, with the location it belongs to. */
export interface MachineRow {
	machine: appApi.MachineSummary
	locationName: string
	isOnline: boolean
}

export type MachineSortKey = 'status' | 'name' | 'location'

export const MACHINE_SORT_LABELS: Record<MachineSortKey, string> = {
	status: 'Status',
	name: 'Name',
	location: 'Location',
}

const byName = (a: MachineRow, b: MachineRow) =>
	a.machine.machineName.localeCompare(b.machine.machineName)

const byStatus = (a: MachineRow, b: MachineRow) => Number(b.isOnline) - Number(a.isOnline)

const byLocation = (a: MachineRow, b: MachineRow) => a.locationName.localeCompare(b.locationName)

const COMPARATORS: Record<MachineSortKey, (a: MachineRow, b: MachineRow) => number> = {
	status: (a, b) => byStatus(a, b) || byName(a, b),
	name: byName,
	location: (a, b) => byLocation(a, b) || byStatus(a, b) || byName(a, b),
}

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
	sortKey: MachineSortKey
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
		.toSorted(COMPARATORS[sortKey])
}
