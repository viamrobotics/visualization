import { PoseInFrame, robotApi, Transform } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { armPartAtOrigin } from '../armPartAtOrigin'

const part = (name: string, parent: string, x: number): robotApi.FrameSystemConfig =>
	new robotApi.FrameSystemConfig({
		frame: new Transform({
			referenceFrame: name,
			poseInObserverFrame: new PoseInFrame({
				referenceFrame: parent,
				pose: { x, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 90 },
			}),
		}),
	})

const parts = [part('arm', 'table', 500), part('gripper', 'arm', 100), part('table', 'world', 0)]

describe('armPartAtOrigin', () => {
	it('keeps only the named arm, so a gripper mounted on it is not drawn', () => {
		expect(armPartAtOrigin(parts, 'arm')?.frame?.referenceFrame).toBe('arm')
	})

	it('moves the arm base to the world origin, wherever the machine mounts it', () => {
		const pose = armPartAtOrigin(parts, 'arm')?.frame?.poseInObserverFrame

		expect(pose?.referenceFrame).toBe('world')
		expect(pose?.pose).toMatchObject({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })
	})

	it('leaves the cached reply untouched, which a machine view of the same part still reads', () => {
		armPartAtOrigin(parts, 'arm')

		expect(parts[0].frame?.poseInObserverFrame?.referenceFrame).toBe('table')
		expect(parts[0].frame?.poseInObserverFrame?.pose?.x).toBe(500)
	})

	it('finds nothing for an arm the frame system does not have', () => {
		expect(armPartAtOrigin(parts, 'other-arm')).toBeUndefined()
	})
})
