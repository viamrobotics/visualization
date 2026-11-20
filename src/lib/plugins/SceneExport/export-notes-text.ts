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
		'The snapshot position of these joints could not be measured, so they start at zero. A joint needs a pose polled through it, and only one joint between two links.',
	'link-not-articulated':
		'These links no longer hang from their parent in the kinematics model, or their joint type is unsupported or has no axis, so they are welded where the snapshot shows them.',
	'mesh-empty-skipped': 'These meshes have no vertices and were left out.',
	'collision-mesh-hulled':
		'These moving collision meshes collide as their convex hulls in the URDF, because physics engines handle concave meshes on moving bodies badly.',
	'mujoco-hulls-collision-mesh':
		'MuJoCo collides every mesh as its convex hull, so these collision meshes are larger than they look wherever they are concave.',
	'mujoco-flat-mesh-visual-only':
		'These collision meshes are flat. MuJoCo cannot build a convex hull with no volume, so in the MJCF they are drawn but do not collide.',
	'mujoco-mesh-too-few-vertices':
		'These meshes have fewer than 4 distinct vertices, which MuJoCo cannot load, so they were left out of the MJCF.',
	'inertia-estimated':
		'Mass and inertia are estimated from collision geometry at the density of water, not measured.',
	'joint-limits-placeholder':
		'Joint effort limits, velocity limits the model does not set, and the travel of unlimited prismatic joints are placeholders.',
}

/** Each reason with the distinct subjects noted under it, in the order reasons were first noted. */
const subjectsByReason = (
	notes: readonly SimExportNote[]
): Map<SimExportNoteReason, Set<string>> => {
	const grouped = new Map<SimExportNoteReason, Set<string>>()
	for (const { reason, subject } of notes) {
		const subjects = grouped.get(reason)
		if (subjects) subjects.add(subject)
		else grouped.set(reason, new Set([subject]))
	}
	return grouped
}

/** How many entries `export-notes.txt` lists for `notes`, with repeats counted once. */
export const countExportNotes = (notes: readonly SimExportNote[]): number =>
	[...subjectsByReason(notes).values()].reduce((count, subjects) => count + subjects.size, 0)

/**
 * The notes as plain text for `export-notes.txt`: one paragraph per reason, then what it applies
 * to. Reasons appear in the order they were first noted.
 */
export const exportNotesText = (notes: readonly SimExportNote[]): string => {
	if (notes.length === 0) return 'Nothing was left out or approximated.\n'

	const paragraphs = [...subjectsByReason(notes)].map(([reason, subjects]) =>
		[EXPLANATIONS[reason], ...[...subjects].map((subject) => `  - ${subject}`)].join('\n')
	)
	return `${paragraphs.join('\n\n')}\n`
}
