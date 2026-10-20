import type { PlainMessage } from '@bufbuild/protobuf'
import type { Transport } from '@connectrpc/connect'

import { Struct, Value } from '@bufbuild/protobuf'
import { Code, ConnectError, createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { Color } from 'three'

import type { ExportKind } from '$lib/buf/kinematics/v1/kinematics_service_pb'

import { Pose, PoseInFrame, Transform, Vector3 } from '$lib/buf/common/v1/common_pb'
import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import { KinematicsService } from '$lib/buf/kinematics/v1/kinematics_service_connect'
import {
	CollisionShape,
	type ImportReport,
	Joint,
	JointType,
	KinematicsSpec,
	LengthUnit,
	Link,
	type ValidationReport,
} from '$lib/buf/kinematics/v1/spec_pb'
import { resourceColors } from '$lib/color'
import { TRANSLUCENT_GEOMETRY_OPACITY } from '$lib/ecs'

import { carryJointSubtree } from './carryJointSubtree'
import { commonFolderName } from './commonFolderName'

/** `incomplete`: the spec references mesh files the workbench does not hold, so no build runs. */
export type WorkbenchStatus = 'empty' | 'incomplete' | 'building' | 'ready' | 'error'

export interface SourceFile {
	name: string
	bytes: Uint8Array
}

/** What an URDF import reads: every file of a package or folder, or one zip of them. */
export type UrdfUpload = { files: SourceFile[] } | { zip: Uint8Array }

export interface ModuleExportOptions {
	namespace: string
	moduleName: string
	modelName: string
}

export interface ExportedZip {
	bytes: Uint8Array
	fileName: string
}

/** A build kept from before the latest mesh file replacement, for comparison. */
export interface PreviousBuild {
	readonly report: ValidationReport
	/** That build's collision geometry, re-keyed so it can render beside the current one. */
	readonly snapshot: Snapshot
}

export interface KinematicsWorkbench {
	/** The spec as last edited. Replaced on every edit, never mutated in place. */
	readonly spec: KinematicsSpec
	readonly status: WorkbenchStatus
	/** Why the last build did not run: a spec the server rejected, or an unreachable draw server. */
	readonly error: string | undefined
	/** The last successful build's report, kept while a rebuild is in flight. */
	readonly report: ValidationReport | undefined
	/**
	 * The last successful build at zero inputs, ready for `<Snapshot>`. Includes visual meshes when
	 * `showVisualMeshes` is on. Its uuid is fixed for the workbench's lifetime, so a rebuild updates
	 * entities in place. Before the first build, and while the spec has no links, it holds a
	 * placeholder: a `root` frame at identity and a `tcp` frame under it at `spec.tcpPose`.
	 */
	readonly snapshot: Snapshot
	/** Ask each build for the full-detail visual meshes too. */
	showVisualMeshes: boolean
	/**
	 * Show each link's collision geometry. Defaults to true. Turning it off strips the geometry from
	 * the link frames in `snapshot`, keeping visual meshes, joints, and the TCP. It never rebuilds.
	 */
	showCollision: boolean
	/**
	 * Adds one link per file, keyed by file name as its `mesh_path`. Re-adding a name replaces its
	 * bytes and keeps that link's calibration.
	 */
	addSources(files: SourceFile[]): void
	removeLink(id: string): void
	updateLink(id: string, patch: Partial<PlainMessage<Link>>): void
	setName(name: string): void
	setTcpPose(pose: PlainMessage<Pose>): void
	/** Exports the current spec and mesh files. Rejects with the server's message when the model is invalid. */
	exportZip(kind: ExportKind, module?: ModuleExportOptions): Promise<ExportedZip>
	/** Mesh paths the spec references with no bytes held, sorted. Empty when complete. */
	readonly missingSources: string[]
	/** The build before the most recent `setSourceBytes` replaced existing bytes. */
	readonly previous: PreviousBuild | undefined
	/** Render `previous.snapshot` beside the current build, as a ghost. */
	showPrevious: boolean
	/**
	 * Replaces the spec and every mesh file. `SourceFile.name` is the `mesh_path` it satisfies. Clears
	 * `previous`.
	 */
	loadProject(spec: KinematicsSpec, sources: SourceFile[]): void
	/** Reads a zip through `KinematicsService.Import`, then `loadProject`. Rejects with the server's message. */
	importZip(bytes: Uint8Array): Promise<void>
	/**
	 * Reads an URDF package through `KinematicsService.ImportURDF`, then loads it like `loadProject`.
	 * Keeps `importReport` and the upload. Rejects with the server's message.
	 */
	importUrdf(upload: UrdfUpload): Promise<void>
	/** The last URDF import's report. Any other load clears it. */
	readonly importReport: ImportReport | undefined
	/** Re-runs the stored URDF upload with `tcpLink` set to `link`. No-op without an upload. */
	chooseImportTcp(link: string): Promise<void>
	/** Sets the link's `maxTriangles` to its report's `suggestedMaxTriangles`. No-op without one. */
	simplify(linkId: string): void
	/** `simplify` for every link the report marks `overTriangleLimit`. */
	simplifyAll(): void
	/**
	 * Sets the bytes for one `mesh_path`, keeping every link's calibration. Supplies a missing mesh file,
	 * or replaces one, in which case the current build becomes `previous`.
	 */
	setSourceBytes(meshPath: string, bytes: Uint8Array): void
	/**
	 * Adds a joint mounted on the model base at the assembly origin: prismatic along +Z from 0 to
	 * 100 mm unless `joint` says otherwise. The id comes from `joint.id`, made unique among links and
	 * joints.
	 *
	 * @returns The id the joint was given.
	 */
	addJoint(joint: Partial<PlainMessage<Joint>>): string
	/**
	 * Changing `id` also rewrites every link, joint, mimic, and TCP parent that referenced it.
	 * Changing `origin` moves every link, joint, and the TCP that ride the joint by the same amount.
	 */
	updateJoint(id: string, patch: Partial<PlainMessage<Joint>>): void
	/**
	 * Removes a joint. Links, joints, and the TCP frame that rode on it move to its parent, and
	 * joints that mimicked it lose their mimic.
	 */
	removeJoint(id: string): void
	/** The joint the TCP frame moves with, or `''` for the model base. */
	setTcpParent(parent: string): void
	/**
	 * One value per model input from the last report, in RDK units (mm, radians). Reset to zero,
	 * clamped into each limit, when a build changes the input count.
	 */
	readonly inputs: number[]
	/** Sets one input, clamped into its limit, and re-poses the preview through `Pose`. */
	setInput(index: number, value: number): void
	/** Cancels a pending debounced build and ignores any in flight. */
	destroy(): void
}

export interface WorkbenchOptions {
	/** Delay between the last edit and the build it triggers. */
	debounceMs?: number
	/** Delay between the last input change and the pose request it triggers. */
	poseDebounceMs?: number
	/** Replaces the Connect transport built from the base URL, for tests. */
	transport?: Transport
}

/**
 * State for the `/kinematics` route: the spec under edit, its mesh files, and the latest build
 * from `KinematicsService` on the draw server. Every edit schedules a debounced rebuild, and a
 * build superseded by a later edit is discarded.
 *
 * @param getBaseUrl Read per request, because the sidecar port can settle after creation.
 */
/** COLLADA files declare their own unit and the server applies it first, so a DAE defaults to metres. */
const defaultMeshUnit = (fileName: string) =>
	/\.dae$/i.test(fileName) ? LengthUnit.METERS : LengthUnit.MILLIMETERS

export const createKinematicsWorkbench = (
	getBaseUrl: () => string,
	options: WorkbenchOptions = {}
): KinematicsWorkbench => {
	const debounceMs = options.debounceMs ?? 250
	const poseDebounceMs = options.poseDebounceMs ?? 30

	let spec = $state.raw(new KinematicsSpec())
	let sources = $state.raw<Map<string, Uint8Array>>(new Map())
	let status = $state.raw<WorkbenchStatus>('empty')
	let error = $state.raw<string | undefined>(undefined)
	let report = $state.raw<ValidationReport | undefined>(undefined)
	let showVisualMeshes = $state.raw(false)
	let showCollision = $state.raw(true)
	let frames = $state.raw<Transform[]>([])
	let built = $state.raw(false)
	let previous = $state.raw<PreviousBuild | undefined>(undefined)
	let showPrevious = $state.raw(false)
	let inputs = $state.raw<number[]>([])
	let importReport = $state.raw<ImportReport | undefined>(undefined)
	let builtSpec: KinematicsSpec | undefined
	let urdfUpload: UrdfUpload | undefined

	const uuid = crypto.getRandomValues(new Uint8Array(16))

	const missingSources = $derived(missingSourcePaths(spec, sources))
	// A string, so a pose-only edit derives an equal key and leaves `snapshot` alone. A new snapshot
	// would re-render the old frames over the gizmo's drag preview until the rebuild lands.
	const linkIdKey = $derived(JSON.stringify(spec.links.map((link) => link.id)))
	const linkIds = $derived(new Set(JSON.parse(linkIdKey) as string[]))
	const snapshot = $derived.by(() => {
		if (!built) {
			return new Snapshot({
				uuid,
				transforms: placeholderFrames(spec),
			})
		}
		const current = showCollision
			? withTranslucentLinkCollision(linkIds, frames)
			: withoutLinkCollision(linkIds, frames)
		return new Snapshot({
			uuid,
			transforms:
				showPrevious && previous ? [...current, ...previous.snapshot.transforms] : current,
		})
	})

	let timer: ReturnType<typeof setTimeout> | undefined
	let generation = 0
	let poseTimer: ReturnType<typeof setTimeout> | undefined
	let poseGeneration = 0
	let destroyed = false

	const client = () =>
		createClient(
			KinematicsService,
			options.transport ?? createConnectTransport({ baseUrl: getBaseUrl() })
		)

	const sourcesFor = (current: KinematicsSpec): Record<string, Uint8Array> => {
		const result: Record<string, Uint8Array> = {}
		for (const link of current.links) {
			if (link.meshPath === '') continue
			const bytes = sources.get(link.meshPath)
			if (bytes) result[link.meshPath] = bytes
		}
		return result
	}

	const build = async () => {
		timer = undefined
		if (destroyed || spec.links.length === 0 || missingSources.length > 0) return
		const mine = ++generation
		const includeVisualMeshes = showVisualMeshes
		const requestedInputs = inputs
		const requestedSpec = spec
		try {
			const response = await client().build({
				spec,
				sources: sourcesFor(spec),
				includeVisualMeshes,
				inputs: requestedInputs,
			})
			if (destroyed || mine !== generation) return
			report = response.report
			builtSpec = requestedSpec
			poseGeneration++
			clearTimeout(poseTimer)
			poseTimer = undefined
			const reported = response.report?.inputs ?? []
			if (reported.length !== inputs.length) {
				inputs = reported.map((input) => clamp(0, input.min, input.max))
			} else if (inputs.some((value, index) => value !== requestedInputs[index])) {
				schedulePose()
			}
			frames = response.frames
			built = true
			error = undefined
			status = 'ready'
		} catch (error_) {
			if (destroyed || mine !== generation) return
			error = ConnectError.from(error_).rawMessage
			status = 'error'
		}
	}

	const pose = async () => {
		poseTimer = undefined
		if (destroyed || !builtSpec) return
		const mine = ++poseGeneration
		try {
			const response = await client().pose({ spec: builtSpec, inputs })
			if (destroyed || mine !== poseGeneration) return
			frames = mergeByUuid(frames, response.frames)
			error = undefined
			status = 'ready'
		} catch (error_) {
			if (destroyed || mine !== poseGeneration) return
			error = ConnectError.from(error_).rawMessage
			status = 'error'
		}
	}

	const schedulePose = () => {
		if (destroyed) return
		poseGeneration++
		clearTimeout(poseTimer)
		poseTimer = setTimeout(() => void pose(), poseDebounceMs)
	}

	/** Marks the state stale and restarts the single debounce timer. */
	const schedule = () => {
		if (destroyed) return
		generation++
		poseGeneration++
		clearTimeout(timer)
		clearTimeout(poseTimer)
		poseTimer = undefined
		if (spec.links.length === 0) {
			status = 'empty'
			error = undefined
			report = undefined
			frames = []
			built = false
			timer = undefined
			return
		}
		if (missingSources.length > 0) {
			status = 'incomplete'
			error = undefined
			timer = undefined
			return
		}
		status = 'building'
		timer = setTimeout(() => void build(), debounceMs)
	}

	const edit = (mutate: (draft: KinematicsSpec) => void) => {
		const draft = spec.clone()
		mutate(draft)
		spec = draft
		schedule()
	}

	const applyProject = (next: KinematicsSpec, files: SourceFile[]) => {
		spec = next.clone()
		sources = new Map(files.map((file) => [file.name, file.bytes]))
		previous = undefined
		report = undefined
		frames = []
		built = false
		schedule()
	}

	const loadProject = (next: KinematicsSpec, files: SourceFile[]) => {
		importReport = undefined
		urdfUpload = undefined
		applyProject(next, files)
	}

	const runUrdfImport = async (upload: UrdfUpload, tcpLink: string) => {
		let imported
		try {
			imported = await client().importURDF(
				'zip' in upload
					? { zip: new Uint8Array(upload.zip), tcpLink }
					: {
							files: Object.fromEntries(upload.files.map((file) => [file.name, file.bytes])),
							tcpLink,
						}
			)
		} catch (error_) {
			throw new Error(ConnectError.from(error_).rawMessage, { cause: error_ })
		}
		applyProject(
			imported.spec ?? new KinematicsSpec(),
			Object.entries(imported.sources).map(([name, bytes]) => ({ name, bytes }))
		)
		importReport = imported.report
		urdfUpload = upload
	}

	const simplifyLinks = (ids: Set<string>) => {
		const suggested = new Map(
			(report?.links ?? [])
				.filter((entry) => ids.has(entry.id) && entry.suggestedMaxTriangles > 0)
				.map((entry) => [entry.id, entry.suggestedMaxTriangles])
		)
		if (suggested.size === 0) return
		edit((draft) => {
			for (const link of draft.links) {
				const max = suggested.get(link.id)
				if (max !== undefined) link.maxTriangles = max
			}
		})
	}

	return {
		get spec() {
			return spec
		},
		get status() {
			return status
		},
		get error() {
			return error
		},
		get report() {
			return report
		},
		get snapshot() {
			return snapshot
		},
		get importReport() {
			return importReport
		},
		get showVisualMeshes() {
			return showVisualMeshes
		},
		set showVisualMeshes(value: boolean) {
			showVisualMeshes = value
			schedule()
		},
		get showCollision() {
			return showCollision
		},
		set showCollision(value: boolean) {
			showCollision = value
		},
		addSources(files) {
			const nextSources = new Map(sources)
			const draft = spec.clone()
			for (const file of files) {
				nextSources.set(file.name, file.bytes)
				if (draft.links.some((link) => link.meshPath === file.name)) continue
				const taken = new Set(draft.links.map((link) => link.id))
				draft.links.push(
					new Link({
						id: uniqueId(linkIdFromFileName(file.name), taken),
						meshPath: file.name,
						meshUnit: defaultMeshUnit(file.name),
						collision: CollisionShape.MESH,
						maxTriangles: 1000,
						origin: new Pose({ oZ: 1 }),
					})
				)
			}
			if (draft.name === '' && draft.links.length > 0) {
				draft.name = commonFolderName(files) ?? draft.links[0]!.id
			}
			sources = nextSources
			spec = draft
			schedule()
		},
		removeLink(id) {
			const removed = spec.links.find((link) => link.id === id)
			if (!removed) return
			edit((draft) => {
				draft.links = draft.links.filter((link) => link.id !== id)
			})
			if (!spec.links.some((link) => link.meshPath === removed.meshPath)) {
				const nextSources = new Map(sources)
				nextSources.delete(removed.meshPath)
				sources = nextSources
			}
		},
		updateLink(id, patch) {
			edit((draft) => {
				draft.links = draft.links.map((link) =>
					link.id === id ? new Link({ ...link, ...patch }) : link
				)
			})
		},
		setName(name) {
			edit((draft) => {
				draft.name = name
			})
		},
		setTcpPose(pose) {
			edit((draft) => {
				draft.tcpPose = new Pose(pose)
			})
		},
		async exportZip(kind, module) {
			try {
				const response = await client().export({
					spec,
					sources: sourcesFor(spec),
					kind,
					namespace: module?.namespace ?? '',
					moduleName: module?.moduleName ?? '',
					modelName: module?.modelName ?? '',
				})
				return { bytes: response.zip, fileName: response.fileName }
			} catch (error_) {
				throw new Error(ConnectError.from(error_).rawMessage, { cause: error_ })
			}
		},
		get missingSources() {
			return missingSources
		},
		get previous() {
			return previous
		},
		get showPrevious() {
			return showPrevious
		},
		set showPrevious(value: boolean) {
			showPrevious = value
		},
		loadProject,
		async importZip(zip) {
			let imported
			try {
				imported = await client().import({ zip: new Uint8Array(zip) })
			} catch (error_) {
				if (ConnectError.from(error_).code === Code.NotFound) {
					await runUrdfImport({ zip: new Uint8Array(zip) }, '')
					return
				}
				throw new Error(ConnectError.from(error_).rawMessage, { cause: error_ })
			}
			loadProject(
				imported.spec ?? new KinematicsSpec(),
				Object.entries(imported.sources).map(([name, bytes]) => ({ name, bytes }))
			)
		},
		importUrdf: (upload) => runUrdfImport(upload, ''),
		async chooseImportTcp(link) {
			if (urdfUpload) await runUrdfImport(urdfUpload, link)
		},
		simplify(linkId) {
			simplifyLinks(new Set([linkId]))
		},
		simplifyAll() {
			simplifyLinks(
				new Set((report?.links ?? []).filter((entry) => entry.overTriangleLimit).map((e) => e.id))
			)
		},
		setSourceBytes(meshPath, bytes) {
			if (sources.has(meshPath) && report && built) {
				previous = {
					report,
					snapshot: new Snapshot({
						uuid: crypto.getRandomValues(new Uint8Array(16)),
						transforms: linkGhosts(spec, frames),
					}),
				}
			}
			const nextSources = new Map(sources)
			nextSources.set(meshPath, bytes)
			sources = nextSources
			schedule()
		},
		addJoint(joint) {
			let id = ''
			edit((draft) => {
				const taken = new Set([
					...draft.links.map((link) => link.id),
					...draft.joints.map((existing) => existing.id),
				])
				id = uniqueId(jointIdFrom(joint.id || undefined), taken)
				draft.joints.push(
					new Joint({
						type: JointType.PRISMATIC,
						origin: new Pose({ oZ: 1 }),
						axis: new Vector3({ z: 1 }),
						lower: 0,
						upper: 100,
						parent: '',
						...joint,
						id,
					})
				)
			})
			return id
		},
		updateJoint(id, patch) {
			if (!spec.joints.some((joint) => joint.id === id)) return
			const nextId = patch.id ?? id
			edit((draft) => {
				if (patch.origin) carryJointSubtree(draft, id, patch.origin)
				draft.joints = draft.joints.map((joint) =>
					joint.id === id ? new Joint({ ...joint, ...patch }) : joint
				)
				if (nextId === id) return
				for (const link of draft.links) if (link.parent === id) link.parent = nextId
				for (const joint of draft.joints) {
					if (joint.parent === id) joint.parent = nextId
					if (joint.mimic?.joint === id) joint.mimic.joint = nextId
				}
				if (draft.tcpParent === id) draft.tcpParent = nextId
			})
		},
		removeJoint(id) {
			const removed = spec.joints.find((joint) => joint.id === id)
			if (!removed) return
			edit((draft) => {
				draft.joints = draft.joints.filter((joint) => joint.id !== id)
				for (const link of draft.links) if (link.parent === id) link.parent = removed.parent
				for (const joint of draft.joints) {
					if (joint.parent === id) joint.parent = removed.parent
					if (joint.mimic?.joint === id) joint.mimic = undefined
				}
				if (draft.tcpParent === id) draft.tcpParent = removed.parent
			})
		},
		setTcpParent(parent) {
			edit((draft) => {
				draft.tcpParent = parent
			})
		},
		get inputs(): number[] {
			return inputs
		},
		setInput(index, value) {
			const limit = report?.inputs[index]
			if (!limit || index < 0 || index >= inputs.length) return
			inputs = inputs.map((current, position) =>
				position === index ? clamp(value, limit.min, limit.max) : current
			)
			schedulePose()
		},
		destroy() {
			destroyed = true
			generation++
			poseGeneration++
			clearTimeout(timer)
			clearTimeout(poseTimer)
			timer = undefined
			poseTimer = undefined
		},
	}
}

const uuidBytes = (text: string): Uint8Array<ArrayBuffer> =>
	Uint8Array.from(text.replaceAll('-', '').match(/../g)!, (pair) => Number.parseInt(pair, 16))

// Equal to `stableUUID("root")` and `stableUUID("tcp")` in `kinematics/preview_transforms.go`.
const ROOT_UUID = uuidBytes('6305ff31-7a66-5dd5-b656-75cb312f08d6')
const TCP_UUID = uuidBytes('f30a312b-6ec2-55ac-9539-3ae21322fe94')

/** The placeholder snapshot's frames: `root` at identity under the world, `tcp` under it. */
const placeholderFrames = (spec: KinematicsSpec): Transform[] => [
	new Transform({
		referenceFrame: 'root',
		poseInObserverFrame: new PoseInFrame({ referenceFrame: 'world', pose: new Pose({ oZ: 1 }) }),
		uuid: ROOT_UUID,
	}),
	new Transform({
		referenceFrame: 'tcp',
		poseInObserverFrame: new PoseInFrame({
			referenceFrame: 'root',
			pose: new Pose(spec.tcpPose ?? { oZ: 1 }),
		}),
		uuid: TCP_UUID,
	}),
]

/** Link id from a file name: lowercase, no extension, `[a-z0-9_-]` only, starting alphanumeric. */
const linkIdFromFileName = (fileName: string): string => {
	const id = fileName
		.toLowerCase()
		.replace(/\.[^.]*$/, '')
		.replaceAll(/[^a-z0-9_-]/g, '-')
		.replace(/^[^a-z0-9]+/, '')
	if (id === '') return 'link'
	// `tcp` is reserved by the compiler for the TCP frame, `root` for the model root.
	return id === 'tcp' || id === 'root' ? `${id}-link` : id
}

const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max)

/** Joint id base: `tcp`, `root`, and ids ending in `_origin` are reserved by the compiler. */
const jointIdFrom = (id = 'joint'): string =>
	id === 'tcp' || id === 'root' || id.endsWith('_origin') ? `${id}-joint` : id

const uniqueId = (base: string, taken: Set<string>): string => {
	if (!taken.has(base)) return base
	let suffix = 2
	while (taken.has(`${base}-${suffix}`)) suffix++
	return `${base}-${suffix}`
}

const missingSourcePaths = (spec: KinematicsSpec, held: Map<string, Uint8Array>): string[] =>
	[
		...new Set(
			spec.links.map((link) => link.meshPath).filter((path) => path !== '' && !held.has(path))
		),
	].toSorted()

/** `frames` with the geometry removed from the frames named in `linkIds`. */
const withoutLinkCollision = (linkIds: ReadonlySet<string>, frames: Transform[]): Transform[] => {
	return frames.map((frame) => {
		if (!linkIds.has(frame.referenceFrame) || frame.physicalObject === undefined) return frame
		const stripped = frame.clone()
		stripped.physicalObject = undefined
		return stripped
	})
}

/** The opacity byte of the translucent colliders the viewer draws for a machine's frames. */
const COLLISION_OPACITY = new Uint8Array([Math.round(TRANSLUCENT_GEOMETRY_OPACITY * 255)])

const gripperColor = new Color(resourceColors.gripper)

/**
 * The color the viewer gives a gripper's colliders on a machine, which the exported module is.
 * Stored as the linear channels `traits.Color` holds, the same values the machine path writes.
 */
const COLLISION_COLOR = Uint8Array.from(
	[gripperColor.r, gripperColor.g, gripperColor.b],
	(channel) => Math.round(channel * 255)
)

/**
 * `frames` with the geometry of the frames named in `linkIds` drawn as the viewer draws a
 * machine's colliders: translucent, in the gripper color, so the opaque visual meshes inside
 * stay readable and distinct from them.
 */
const withTranslucentLinkCollision = (
	linkIds: ReadonlySet<string>,
	frames: Transform[]
): Transform[] => {
	return frames.map((frame) => {
		if (!linkIds.has(frame.referenceFrame) || frame.physicalObject === undefined) return frame
		const styled = frame.clone()
		styled.metadata = new Struct({
			fields: {
				...frame.metadata?.fields,
				colors: new Value({ kind: { case: 'stringValue', value: toBase64(COLLISION_COLOR) } }),
				color_format: new Value({ kind: { case: 'numberValue', value: ColorFormat.RGB } }),
				opacities: new Value({ kind: { case: 'stringValue', value: toBase64(COLLISION_OPACITY) } }),
			},
		})
		return styled
	})
}

const GHOST_COLOR = new Uint8Array([160, 160, 160])
const GHOST_OPACITY = new Uint8Array([64])

const toBase64 = (bytes: Uint8Array): string => {
	let binary = ''
	for (const byte of bytes) binary += String.fromCodePoint(byte)
	return btoa(binary)
}

const uuidKey = (uuid: Uint8Array): string => uuid.join(',')

/** `current` with each frame replaced by the `updates` entry of the same uuid. Other frames stay as they are. */
const mergeByUuid = (current: Transform[], updates: Transform[]): Transform[] => {
	const byUuid = new Map(updates.map((update) => [uuidKey(update.uuid), update]))
	return current.map((frame) => byUuid.get(uuidKey(frame.uuid)) ?? frame)
}

/**
 * Each link's collision frame as a faint gray ghost keyed `<id> previous`, parented to that link
 * with an identity pose, so it follows the link's joint.
 */
const linkGhosts = (spec: KinematicsSpec, frames: Transform[]): Transform[] => {
	const ghosts: Transform[] = []
	for (const link of spec.links) {
		const linkFrame = frames.find(
			(frame) => frame.referenceFrame === link.id && frame.physicalObject !== undefined
		)
		if (!linkFrame) continue
		ghosts.push(
			new Transform({
				referenceFrame: `${link.id} previous`,
				poseInObserverFrame: new PoseInFrame({
					referenceFrame: link.id,
					pose: new Pose({ oZ: 1 }),
				}),
				physicalObject: linkFrame.physicalObject,
				uuid: crypto.getRandomValues(new Uint8Array(16)),
				metadata: Struct.fromJson({
					colors: toBase64(GHOST_COLOR),
					color_format: ColorFormat.RGB,
					opacities: toBase64(GHOST_OPACITY),
				}),
			})
		)
	}
	return ghosts
}
