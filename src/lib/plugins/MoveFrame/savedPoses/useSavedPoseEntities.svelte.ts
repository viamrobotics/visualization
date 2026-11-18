import type { Entity } from 'koota'

import { traits, useWorld } from '$lib/ecs'
import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

import { parseArmPositionSaver } from './armPositionSaver'

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
				existing.set(traits.SavedPose, savedPose)
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
