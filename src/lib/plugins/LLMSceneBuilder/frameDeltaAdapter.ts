import type { Frame, FrameGeometry } from '$lib/frame'
import type { Transform } from '$lib/geometry'
import type { FragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'
import type { PartConfig } from '$lib/hooks/usePartConfig.svelte'

import { frameGeometryFromTransform } from '$lib/geometry'
import { Pose } from '$lib/math'
import { setOrientationFromEuler } from '$lib/math/transform'

/**
 * Resolves current frames for fragment-defined components from live framesystem
 * data and any config $set overrides. Returns a FragmentInfo map suitable for
 * validateProposedFrameDeltas and LLM inference.
 */
export function resolveFragmentCurrentFrames(
	fragmentNames: string[],
	fragmentInfo: Record<string, FragmentInfo>,
	liveFrames: Transform[],
	configFrames: Record<string, Transform>
): Record<string, FragmentInfo> {
	const liveByName: Record<string, Transform> = {}
	for (const frame of liveFrames) {
		liveByName[frame.referenceFrame] = frame
	}

	const result: Record<string, FragmentInfo> = {}
	for (const name of fragmentNames) {
		const meta = fragmentInfo[name]
		if (!meta) continue

		const transform = configFrames[name] ?? liveByName[name]
		const observed = transform?.poseInObserverFrame
		if (!observed) continue

		const pose = new Pose().copy(observed.pose)

		result[name] = {
			id: meta.id,
			variables: meta.variables,
			frame: {
				parent: observed.referenceFrame,
				translation: {
					x: pose.x,
					y: pose.y,
					z: pose.z,
				},
				orientation: {
					type: 'ov_degrees',
					value: {
						x: pose.oX,
						y: pose.oY,
						z: pose.oZ,
						th: pose.theta,
					},
				},
				geometry: frameGeometryFromTransform(transform),
			},
		}
	}

	return result
}

export interface FrameDelta {
	componentName: string
	translation?: { x?: number; y?: number; z?: number }
	orientation?: { roll?: number; pitch?: number; yaw?: number }
	/** Only the changed fields are sent, all in mm. Omit `type` to resize the current shape, and unspecified dims fall back to the current geometry. Include `type` only to change the shape, then send that type's dims (box x/y/z, sphere r, capsule r/l). `type: 'none'` removes the geometry. */
	geometry?: {
		type?: FrameGeometry
		x?: number
		y?: number
		z?: number
		r?: number
		l?: number
	}
	parent?: string
	explanation?: string
}

export interface PreparedUpdate {
	componentName: string
	parent: string
	previousParent: string
	pose: Pose
	previousPose: Pose
	geometry?: Frame['geometry']
	previousGeometry?: Frame['geometry']
	explanation?: string
}

export interface UpdateError {
	componentName: string
	reason: string
}

function mergeTranslation(
	a?: FrameDelta['translation'],
	b?: FrameDelta['translation']
): FrameDelta['translation'] {
	return a || b ? { x: b?.x ?? a?.x, y: b?.y ?? a?.y, z: b?.z ?? a?.z } : undefined
}

function mergeOrientation(
	a?: FrameDelta['orientation'],
	b?: FrameDelta['orientation']
): FrameDelta['orientation'] {
	return a || b
		? { roll: b?.roll ?? a?.roll, pitch: b?.pitch ?? a?.pitch, yaw: b?.yaw ?? a?.yaw }
		: undefined
}

function mergeGeometry(
	a?: FrameDelta['geometry'],
	b?: FrameDelta['geometry']
): FrameDelta['geometry'] {
	if (!a || !b) {
		return a ?? b
	}

	// If `b` explicitly changes the type, its dims fully replace `a` to prevent leaking stale dimension fields.
	if (b.type !== undefined && b.type !== a.type) {
		return { type: b.type, x: b.x, y: b.y, z: b.z, r: b.r, l: b.l }
	}

	return {
		type: b.type ?? a.type,
		x: b.x ?? a.x,
		y: b.y ?? a.y,
		z: b.z ?? a.z,
		r: b.r ?? a.r,
		l: b.l ?? a.l,
	}
}

const isPositive = (v: number | undefined): v is number =>
	typeof v === 'number' && Number.isFinite(v) && v > 0

/**
 * Resolves a geometry delta against the component's current geometry. Unspecified
 * dimensions fall back to the current geometry when the type is unchanged (mirroring
 * how translation axes fall back to the current pose). `type: 'none'` removes the
 * geometry. Returns an error string when a required dimension is missing/non-positive
 * or the type cannot be determined.
 */
function resolveGeometry(
	delta: NonNullable<FrameDelta['geometry']>,
	current: Frame['geometry']
): { geometry?: Frame['geometry']; error?: string } {
	if (delta.type === 'none') {
		return { geometry: { type: 'none' } }
	}

	const type = delta.type ?? (current && current.type !== 'none' ? current.type : undefined)
	if (!type) {
		return { error: 'Geometry change requires a type — the component has no existing geometry' }
	}

	switch (type) {
		case 'box': {
			const cur = current?.type === 'box' ? current : undefined
			const x = delta.x ?? cur?.x
			const y = delta.y ?? cur?.y
			const z = delta.z ?? cur?.z
			if (!isPositive(x) || !isPositive(y) || !isPositive(z)) {
				return { error: 'Box geometry requires positive x, y, z dimensions' }
			}
			return { geometry: { type: 'box', x, y, z } }
		}
		case 'sphere': {
			const cur = current?.type === 'sphere' ? current : undefined
			const r = delta.r ?? cur?.r
			if (!isPositive(r)) {
				return { error: 'Sphere geometry requires a positive radius r' }
			}
			return { geometry: { type: 'sphere', r } }
		}
		case 'capsule': {
			const cur = current?.type === 'capsule' ? current : undefined
			const r = delta.r ?? cur?.r
			const l = delta.l ?? cur?.l
			if (!isPositive(r) || !isPositive(l)) {
				return { error: 'Capsule geometry requires positive radius r and length l' }
			}
			return { geometry: { type: 'capsule', r, l } }
		}
		default: {
			const _exhaustive: never = type
			return { error: `Unknown geometry type: ${_exhaustive}` }
		}
	}
}

/**
 * Validates LLM-proposed frame deltas and computes the resulting changes without
 * applying them. Each PreparedUpdate carries old and new values so the caller
 * can render a diff and confirm via useSceneBuilder's confirm().
 */
export function validateProposedFrameDeltas(
	deltas: FrameDelta[],
	config: PartConfig,
	fragmentFrames: Record<string, FragmentInfo> = {}
): { errors: UpdateError[]; prepared: PreparedUpdate[] } {
	const errors: UpdateError[] = []
	const prepared: PreparedUpdate[] = []
	const knownNames = new Set([
		...config.components.map((c) => c.name),
		...Object.keys(fragmentFrames),
	])

	// Merge multiple deltas for the same component — the LLM sometimes splits
	// translation and orientation into separate entries despite the schema saying one per component.
	const mergedDeltas = new Map<string, FrameDelta>()
	for (const delta of deltas) {
		const existing = mergedDeltas.get(delta.componentName)
		if (existing) {
			mergedDeltas.set(delta.componentName, {
				componentName: delta.componentName,
				translation: mergeTranslation(existing.translation, delta.translation),
				orientation: mergeOrientation(existing.orientation, delta.orientation),
				geometry: mergeGeometry(existing.geometry, delta.geometry),
				parent: delta.parent ?? existing.parent,
				explanation:
					[existing.explanation, delta.explanation].filter(Boolean).join(', ') || undefined,
			})
		} else {
			mergedDeltas.set(delta.componentName, delta)
		}
	}

	for (const delta of mergedDeltas.values()) {
		const partComponent = config.components.find((c) => c.name === delta.componentName)
		// Fragment-defined components aren't in config.components; their current
		// frame comes from `fragmentFrames` (resolved from the live framesystem).
		// Part config wins when the same name exists in both.
		const fragmentEntry = partComponent ? undefined : fragmentFrames[delta.componentName]
		const frame = partComponent?.frame ?? fragmentEntry?.frame

		if (!partComponent && !fragmentEntry) {
			errors.push({ componentName: delta.componentName, reason: 'Component not found in config' })
			continue
		}

		if (!frame) {
			errors.push({
				componentName: delta.componentName,
				reason: fragmentEntry ? 'Fragment has no frame' : 'Component has no frame',
			})
			continue
		}

		if (
			delta.parent !== undefined &&
			delta.parent !== 'world' &&
			(!knownNames.has(delta.parent) || delta.parent === delta.componentName)
		) {
			errors.push({
				componentName: delta.componentName,
				reason:
					delta.parent === delta.componentName
						? `Component cannot be its own parent`
						: `Parent '${delta.parent}' not found in config`,
			})
			continue
		}

		const previousPose = new Pose().setFromFrame(frame)
		const previousParent = frame.parent
		const previousGeometry = frame.geometry

		let geometry = previousGeometry
		if (delta.geometry) {
			const resolved = resolveGeometry(delta.geometry, previousGeometry)
			if (resolved.error) {
				errors.push({ componentName: delta.componentName, reason: resolved.error })
				continue
			}
			geometry = resolved.geometry
		}

		const newParent = delta.parent ?? previousParent
		const newPose = new Pose(
			delta.translation?.x ?? previousPose.x,
			delta.translation?.y ?? previousPose.y,
			delta.translation?.z ?? previousPose.z,
			previousPose.oX,
			previousPose.oY,
			previousPose.oZ,
			previousPose.theta
		)

		if (delta.orientation) {
			setOrientationFromEuler(previousPose, delta.orientation, newPose)
		}

		if (
			[newPose.x, newPose.y, newPose.z, newPose.oX, newPose.oY, newPose.oZ, newPose.theta].some(
				(v) => !Number.isFinite(v)
			)
		) {
			errors.push({
				componentName: delta.componentName,
				reason: 'Proposed values contain non-finite numbers',
			})
			continue
		}

		prepared.push({
			componentName: delta.componentName,
			parent: newParent,
			previousParent,
			pose: newPose,
			previousPose,
			geometry,
			previousGeometry,
			explanation: delta.explanation,
		})
	}

	return { errors, prepared }
}
