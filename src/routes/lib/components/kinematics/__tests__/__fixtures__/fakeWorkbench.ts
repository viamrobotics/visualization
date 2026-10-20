import { vi } from 'vitest'

import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import { KinematicsSpec } from '$lib/buf/kinematics/v1/spec_pb'

import type { KinematicsWorkbench } from '../../../../kinematics/kinematicsWorkbench.svelte'

/** A workbench whose methods are spies, with any member overridable. */
export const fakeWorkbench = (overrides: Partial<KinematicsWorkbench> = {}) => {
	const workbench = {
		spec: new KinematicsSpec(),
		status: 'ready',
		error: undefined,
		report: undefined,
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
		addJoint: vi.fn(() => 'joint'),
		updateJoint: vi.fn(),
		removeJoint: vi.fn(),
		setTcpParent: vi.fn(),
		importUrdf: vi.fn(),
		importReport: undefined,
		chooseImportTcp: vi.fn(),
		simplify: vi.fn(),
		simplifyAll: vi.fn(),
		inputs: [],
		setInput: vi.fn(),
		destroy: vi.fn(),
		...overrides,
	} satisfies KinematicsWorkbench
	return { workbench, updateLink: workbench.updateLink, setSourceBytes: workbench.setSourceBytes }
}
