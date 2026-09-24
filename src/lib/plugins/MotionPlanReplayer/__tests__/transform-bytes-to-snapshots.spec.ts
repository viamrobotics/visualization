import { describe, expect, it } from 'vitest'

import { Pose, PoseInFrame, Transform } from '$lib/buf/common/v1/common_pb'

import { transformBytesToSnapshots, transformsToSnapshot } from '../plan-to-snapshots'

describe('transformsToSnapshot', () => {
	it('wraps a step of transforms into a snapshot with a snapshot-level uuid', () => {
		const transform = new Transform({ referenceFrame: 'arm:base', uuid: new Uint8Array([1, 2, 3]) })
		const snapshot = transformsToSnapshot([transform])

		expect(snapshot.transforms.length).toBe(1)
		expect(snapshot.transforms[0]!.referenceFrame).toBe('arm:base')
		expect(snapshot.uuid.length).toBeGreaterThan(0)
	})
})

describe('transformBytesToSnapshots', () => {
	const frameUUID = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6])
	const encode = (frame: string): Uint8Array =>
		new Transform({
			referenceFrame: frame,
			uuid: frameUUID,
			poseInObserverFrame: new PoseInFrame({ referenceFrame: 'world', pose: new Pose() }),
		}).toBinary()

	it('decodes serialized transform bytes into one snapshot per step', () => {
		const snapshots = transformBytesToSnapshots([[encode('arm:base')], [encode('arm:base')]])
		expect(snapshots.length).toBe(2)
	})

	it('preserves referenceFrame, pose, and uuid through the byte round-trip', () => {
		const [snapshot] = transformBytesToSnapshots([[encode('arm:base')]])
		const transform = snapshot!.transforms[0]!

		expect(transform.referenceFrame).toBe('arm:base')
		expect(transform.uuid).toEqual(frameUUID)
		expect(transform.poseInObserverFrame?.referenceFrame).toBe('world')
	})

	it('keeps a frame uuid identical across steps (required for in-place reconcile)', () => {
		const [first, second] = transformBytesToSnapshots([[encode('arm:base')], [encode('arm:base')]])
		expect(second!.transforms[0]!.uuid).toEqual(first!.transforms[0]!.uuid)
	})
})
