import { robotApi, Transform } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { machineFrameNames } from '../machineFrameNames'

const part = (referenceFrame: string) =>
	new robotApi.FrameSystemConfig({ frame: new Transform({ referenceFrame }) })

describe('machineFrameNames', () => {
	it('names every frame the machine reports', () => {
		expect(machineFrameNames([part('arm-1'), part('cam-1')])).toEqual(new Set(['arm-1', 'cam-1']))
	})

	it('adds the links derived from a kinematics model', () => {
		expect(machineFrameNames([part('arm-1')], ['arm-1:upper_arm'])).toEqual(
			new Set(['arm-1', 'arm-1:upper_arm'])
		)
	})

	it('omits a part whose frame the reply left out', () => {
		expect(machineFrameNames([new robotApi.FrameSystemConfig({})])).toEqual(new Set())
	})

	it('omits a nameless frame, which no pose request can address', () => {
		expect(machineFrameNames([part('')])).toEqual(new Set())
	})

	it('names nothing before the machine has answered', () => {
		expect(machineFrameNames()).toEqual(new Set())
	})
})
