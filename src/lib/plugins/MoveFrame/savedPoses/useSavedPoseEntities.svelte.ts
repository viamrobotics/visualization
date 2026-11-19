import type { Entity } from 'koota'

import type { Pose } from '$lib/math'

import { traits, useWorld } from '$lib/ecs'
import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

import { parseArmPositionSaver } from './armPositionSaver'

/** The value `traits.SavedPose` holds. */
interface SavedPoseValue {
	arm: string
	motion: string
	joints: number[] | undefined
	pose: Pose | undefined
}

const isSameJoints = (a: number[] | undefined, b: number[] | undefined): boolean =>
	a === b ||
	(a !== undefined &&
		b !== undefined &&
		a.length === b.length &&
		a.every((value, index) => value === b[index]))

const isSamePose = (a: Pose | undefined, b: Pose | undefined): boolean =>
	a === b || (a !== undefined && a.equals(b))

const isSameSavedPose = (a: SavedPoseValue, b: SavedPoseValue): boolean =>
	a.arm === b.arm &&
	a.motion === b.motion &&
	isSameJoints(a.joints, b.joints) &&
	isSamePose(a.pose, b.pose)

/**
 * Keeps one `SavedPose` row per arm position saver in the part config, for the world tree's
 * Saved poses folder. Rows are diffed by name rather than respawned, so a selected row stays
 * selected while a save rewrites its joints. Mount only while move mode is active.
 */
export const useSavedPoseEntities = (): void => {
	const world = useWorld()
	const partConfig = usePartConfig()

	const savers = $derived(
		(partConfig.current.components ?? []).flatMap((component) => {
			const saver = parseArmPositionSaver(component)
			return saver ? [saver] : []
		})
	)

	const entities = new Map<string, Entity>()

	$effect(() => {
		const wanted = new Map(savers.map((saver) => [saver.name, saver]))

		for (const [name, entity] of entities) {
			if (wanted.has(name) && entity.isAlive()) continue
			if (entity.isAlive()) entity.destroy()
			entities.delete(name)
		}

		for (const { name, arm, motion, joints, pose } of wanted.values()) {
			const savedPose = { arm, motion, joints, pose }

			const existing = entities.get(name)
			if (existing) {
				// Every config edit reparses every saver into new arrays and poses. Setting an unchanged
				// one would still respawn the selected saver's ghost, so only a real change is written.
				const current = existing.get(traits.SavedPose)
				if (!current || !isSameSavedPose(current, savedPose)) {
					existing.set(traits.SavedPose, savedPose)
				}
				continue
			}

			entities.set(
				name,
				world.spawn(traits.Name(name), traits.FramelessComponent, traits.SavedPose(savedPose))
			)
		}
	})

	$effect(() => {
		return () => {
			for (const entity of entities.values()) {
				if (entity.isAlive()) entity.destroy()
			}
			entities.clear()
		}
	})
}
