import type { appApi } from '@viamrobotics/sdk'

import type { MachineRow } from './machineRows'

/**
 * Row heights in pixels. The list virtualizes with these exact sizes, so the row markup must
 * render at them: `h-11` for a machine row, `h-8` for a part row.
 */
export const MACHINE_ITEM_HEIGHT_PX = 44
export const PART_ITEM_HEIGHT_PX = 32

/**
 * One fixed-height line of the machine list. A single-part machine is one pickable line. A
 * multi-part machine is a heading line followed by one pickable line per part.
 */
export type MachineListItem =
	| { kind: 'machine'; row: MachineRow; part: appApi.PartSummary }
	| { kind: 'machine-heading'; row: MachineRow }
	| { kind: 'part'; row: MachineRow; part: appApi.PartSummary }

/** Flattens machine rows into list lines, with each machine's main part first. */
export const toMachineListItems = (rows: MachineRow[]): MachineListItem[] =>
	rows.flatMap((row): MachineListItem[] => {
		const parts = row.machine.partSummaries
		if (parts.length === 1) return [{ kind: 'machine', row, part: parts[0] }]

		const mainFirst = parts.toSorted((a, b) => Number(b.isMainPart) - Number(a.isMainPart))
		return [
			{ kind: 'machine-heading', row },
			...mainFirst.map((part): MachineListItem => ({ kind: 'part', row, part })),
		]
	})

export const machineListItemHeight = (item: MachineListItem): number =>
	item.kind === 'part' ? PART_ITEM_HEIGHT_PX : MACHINE_ITEM_HEIGHT_PX
