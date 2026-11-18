import type { Entity, World } from 'koota'

import { Matrix4 } from 'three'

import type { Frame } from '$lib/frame'
import type { FragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'
import type { ComponentFramesConfig } from '$lib/resolveComponentFrames'

import { hierarchy, traits } from '$lib/ecs'
import { Pose } from '$lib/math'
import { composeLocalMatrix } from '$lib/math/transform'
import { mergedComponentFrames, resolveComponentFrames } from '$lib/resolveComponentFrames'

import { applyGeometryTrait, type EditableFrameGeometry } from './FrameEditor'

type JsonObject = Record<string, unknown>

interface ConfigLike {
	toJson?: () => unknown
}

const emptyPartConfig = { components: [] }
const committedLiveMatrix = new Matrix4()

const toJsonValue = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map((item) => toJsonValue(item))
	}

	if (value && typeof value === 'object') {
		const sorted: JsonObject = {}
		for (const key of Object.keys(value as JsonObject).toSorted()) {
			sorted[key] = toJsonValue((value as JsonObject)[key])
		}
		return sorted
	}

	return value
}

export const serializePartConfig = (
	config: ConfigLike | ComponentFramesConfig | undefined
): string => {
	if (!config) {
		return JSON.stringify(emptyPartConfig)
	}

	if (typeof (config as ConfigLike).toJson === 'function') {
		return JSON.stringify(toJsonValue((config as ConfigLike).toJson?.() ?? emptyPartConfig))
	}

	return JSON.stringify(toJsonValue(config))
}

export const parsePartConfigSnapshot = (snapshot: string): ComponentFramesConfig => {
	try {
		return JSON.parse(snapshot) as ComponentFramesConfig
	} catch {
		return emptyPartConfig
	}
}

const writeMatrixTrait = (
	entity: Entity,
	trait: typeof traits.Matrix | typeof traits.LiveMatrix | typeof traits.EditedMatrix,
	frame: Frame
): void => {
	const pose = new Pose().setFromFrame(frame)
	const current = entity.get(trait)

	if (current) {
		pose.toMatrix4(current)
		entity.changed(trait)
		return
	}

	entity.add(trait(pose.toMatrix4()))
}

export const applyFrameHistorySnapshotToWorld = (
	world: World,
	config: ComponentFramesConfig,
	fragmentInfo: Record<string, FragmentInfo>,
	options: { mode: 'edit' | 'save' | 'discard' }
): void => {
	const resolved = resolveComponentFrames(config, fragmentInfo)
	const frames = mergedComponentFrames(resolved)
	const { unsetFrameNames } = resolved

	for (const entity of world.query(traits.FramesAPI)) {
		const name = entity.get(traits.Name)
		if (!name) {
			continue
		}

		const frame = frames.get(name)

		if (!frame) {
			if (options.mode !== 'edit' || unsetFrameNames.has(name)) {
				entity.remove(traits.EditedMatrix)
			}
			continue
		}

		if (options.mode === 'edit') {
			writeMatrixTrait(entity, traits.EditedMatrix, frame)
		} else {
			const edited = entity.get(traits.EditedMatrix)
			const live = entity.get(traits.LiveMatrix)
			const baseline = entity.get(traits.Matrix)

			// Bake the rendered pose before replacing the baseline. Copying the
			// config pose directly into LiveMatrix would discard live kinematics.
			if (options.mode === 'save' && edited && live && baseline) {
				composeLocalMatrix(live, baseline, edited, committedLiveMatrix)
				live.copy(committedLiveMatrix)
				entity.changed(traits.LiveMatrix)
			}

			writeMatrixTrait(entity, traits.Matrix, frame)
			// Fall back to the config pose only when an edited frame lacks the
			// matrices required to bake its rendered pose.
			if (options.mode === 'save' && edited && (!live || !baseline)) {
				writeMatrixTrait(entity, traits.LiveMatrix, frame)
			}
			entity.remove(traits.EditedMatrix)
		}

		hierarchy.setParent(entity, frame.parent)
		applyGeometryTrait(entity, (frame.geometry ?? { type: 'none' }) as EditableFrameGeometry)
	}
}
