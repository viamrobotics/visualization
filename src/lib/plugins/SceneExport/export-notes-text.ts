import type { SimExportNote, SimExportNoteReason } from './sim-scene'

const EXPLANATIONS: Record<SimExportNoteReason, string> = {
	'point-cloud-skipped': 'Point clouds were left out. URDF and MJCF have no way to describe them.',
	'drawing-skipped':
		'Lines and arrows were left out. URDF and MJCF have no line or arrow geometry.',
	'hidden-skipped': 'Hidden objects were left out.',
	'ghost-skipped': 'Ghost previews were left out.',
	'model-visual-only':
		'These 3D models have no collision geometry in Viam, so they were exported as visual geometry only.',
	'model-load-failed': 'These 3D models failed to load and were left out.',
	'dh-model-not-articulated':
		'These components use Denavit–Hartenberg kinematics, which the export cannot articulate. Their links are welded.',
	'end-effector-unknown':
		'The export could not find the end effector of these components, so frames mounted on them are welded where the snapshot shows them and do not follow the arm.',
	'end-effector-offset-unknown':
		'These frames are mounted on an arm, but their offset from its end effector is unknown, so they are welded where the snapshot shows them and do not follow the arm.',
	'joint-value-unknown':
		'These links sit behind more than one joint, so the snapshot pose of those joints is unknown and they start at zero.',
	'collision-mesh-hulled':
		'These moving collision meshes collide as their convex hulls in the URDF, because physics engines handle concave meshes on moving bodies badly.',
	'mujoco-hulls-collision-mesh':
		'MuJoCo collides every mesh as its convex hull, so these collision meshes are larger than they look wherever they are concave.',
	'inertia-estimated':
		'Mass and inertia are estimated from collision geometry at the density of water, not measured.',
	'joint-limits-placeholder':
		'Joint effort limits, and velocity limits the model does not set, are placeholders.',
}

/**
 * The notes as plain text for `export-notes.txt`: one paragraph per reason, then what it applies
 * to. Reasons appear in the order they were first noted.
 */
export const exportNotesText = (notes: readonly SimExportNote[]): string => {
	if (notes.length === 0) return 'Nothing was left out or approximated.\n'

	const subjectsByReason = new Map<SimExportNoteReason, Set<string>>()
	for (const { reason, subject } of notes) {
		const subjects = subjectsByReason.get(reason) ?? new Set()
		subjects.add(subject)
		subjectsByReason.set(reason, subjects)
	}

	const paragraphs = [...subjectsByReason].map(([reason, subjects]) =>
		[EXPLANATIONS[reason], ...[...subjects].map((subject) => `  - ${subject}`)].join('\n')
	)
	return `${paragraphs.join('\n\n')}\n`
}
