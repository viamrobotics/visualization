import { describe, expect, it } from 'vitest'

import type { JointFrameDescriptor } from '../frameDescriptors'
import type { JointColumn, ModelJson } from '../jointColumns'

import goldenFile from '../../../../tools/rdk-golden/motion/testdata/joint_columns_golden.json'
import { modelJointColumns } from '../jointColumns'
import { jointValueAt } from '../jointPose'

interface GoldenProbe {
	inputs: number[]
	joints: Record<string, number>
}

const cases = goldenFile.cases as unknown as {
	name: string
	model: ModelJson
	dof: number
	probes: GoldenProbe[]
}[]

const probeRows = cases.flatMap(({ name, model, probes }) =>
	probes.map((probe) => ({ name, model, probe, label: `[${probe.inputs.join(', ')}]` }))
)

/** Reading an angle back off a pose on the Go side costs a few ulps, well inside this. */
const PLACES = 9

const COMPONENT = 'arm'

const jointOf = (column: JointColumn): JointFrameDescriptor => ({
	kind: 'joint',
	motion: 'rotational',
	name: `${COMPONENT}:joint`,
	parent: `${COMPONENT}:base`,
	axis: { X: 0, Y: 0, Z: 1 },
	componentName: COMPONENT,
	jointIndex: column.index,
	mimic: column.mimic,
	uuid: new Uint8Array(16) as Uint8Array<ArrayBuffer>,
})

const jointValuesAt = (model: ModelJson, inputs: number[]): Record<string, number> => {
	const { columns } = modelJointColumns(model, COMPONENT)

	return Object.fromEntries(
		[...columns].map(([id, column]) => [id, jointValueAt(jointOf(column), { [COMPONENT]: inputs })])
	)
}

describe('modelJointColumns, against the input schema RDK builds for a model', () => {
	it('reads all 8 models the Go generator wrote', () => {
		expect(cases.length).toBe(8)
	})

	it.each(cases)('gives $name as many columns as RDK gives it DoF', ({ model, dof }) => {
		const { columns } = modelJointColumns(model, COMPONENT)

		expect(new Set([...columns.values()].map((column) => column.index)).size).toBe(dof)
	})
})

describe('modelJointColumns and jointValueAt, against the value RDK drives each joint with', () => {
	it.each(probeRows)('drives every joint of $name as RDK does at $label', ({ model, probe }) => {
		const expected = Object.fromEntries(
			Object.entries(probe.joints).map(([id, value]) => [id, expect.closeTo(value, PLACES)])
		)

		expect(jointValuesAt(model, probe.inputs)).toEqual(expected)
	})
})
