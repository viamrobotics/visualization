import { appApi } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import type { MachineRow } from '../machineRows'

import { toMachineListItems } from '../machineListItems'

const row = (machineName: string, parts: { name: string; isMainPart: boolean }[]): MachineRow => ({
	machine: new appApi.MachineSummary({
		machineId: machineName,
		machineName,
		partSummaries: parts.map(
			({ name, isMainPart }) =>
				new appApi.PartSummary({ partId: `${machineName}-${name}`, partName: name, isMainPart })
		),
	}),
	locationName: 'Lab',
	isOnline: false,
})

const describeItems = (rows: MachineRow[]) =>
	toMachineListItems(rows).map((item) =>
		item.kind === 'machine-heading'
			? `heading:${item.row.machine.machineName}`
			: `${item.kind}:${item.part.partName}`
	)

describe('toMachineListItems', () => {
	it('makes a single-part machine one pickable line', () => {
		expect(describeItems([row('rover', [{ name: 'main', isMainPart: true }])])).toEqual([
			'machine:main',
		])
	})

	it('puts a heading above a multi-part machine, with its main part first', () => {
		const arm = row('arm', [
			{ name: 'camera', isMainPart: false },
			{ name: 'main', isMainPart: true },
		])

		expect(describeItems([arm])).toEqual(['heading:arm', 'part:main', 'part:camera'])
	})
})
