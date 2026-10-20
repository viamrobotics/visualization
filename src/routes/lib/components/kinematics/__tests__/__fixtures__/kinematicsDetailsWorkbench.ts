import { vi } from 'vitest'

import { Pose } from '$lib/buf/common/v1/common_pb'
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import {
	InputReport,
	Joint,
	JointType,
	KinematicsSpec,
	Link,
	ValidationReport,
} from '$lib/buf/kinematics/v1/spec_pb'

import type { KinematicsWorkbench } from '../../../../kinematics/kinematicsWorkbench.svelte'

export const arm = new Link({ id: 'arm', meshPath: 'arm.stl', parent: 'shoulder' })

/** A revolute joint whose origin is 300 mm up the assembly Z axis. */
export const shoulder = new Joint({
	id: 'shoulder',
	type: JointType.REVOLUTE,
	origin: new Pose({ x: 0, y: 0, z: 300, oX: 0, oY: 0, oZ: 1, theta: 0 }),
	lower: -90,
	upper: 90,
})

export const elbow = new Joint({ id: 'elbow', type: JointType.PRISMATIC, parent: 'shoulder' })

/** A workbench whose methods are spies, over a spec of `arm` riding on `shoulder`. */
export const detailsWorkbench = (overrides: Partial<KinematicsWorkbench> = {}) => {
	const workbench = {
		spec: new KinematicsSpec({ name: 'rig', links: [arm], joints: [shoulder, elbow] }),
		status: 'ready',
		error: undefined,
		report: new ValidationReport({
			inputs: [new InputReport({ joint: 'shoulder', type: JointType.REVOLUTE, min: -1, max: 1 })],
		}),
		snapshot: new Snapshot(),
		showVisualMeshes: false,
		showCollision: true,
		addSources: vi.fn(),
		removeLink: vi.fn(),
		updateLink: vi.fn(),
		setName: vi.fn(),
		setTcpPose: vi.fn(),
		exportZip: vi.fn(),
		missingSources: [],
		previous: undefined,
		showPrevious: false,
		loadProject: vi.fn(),
		importZip: vi.fn(),
		setSourceBytes: vi.fn(),
		addJoint: vi.fn(() => 'new-joint'),
		updateJoint: vi.fn(),
		removeJoint: vi.fn(),
		setTcpParent: vi.fn(),
		importUrdf: vi.fn(),
		importReport: undefined,
		chooseImportTcp: vi.fn(),
		simplify: vi.fn(),
		simplifyAll: vi.fn(),
		inputs: [0],
		setInput: vi.fn(),
		destroy: vi.fn(),
		...overrides,
	} satisfies KinematicsWorkbench
	return workbench
}
