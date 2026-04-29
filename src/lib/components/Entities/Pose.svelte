<script lang="ts">
	import type { Pose } from '@viamrobotics/sdk'
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { traits, useTrait } from '$lib/ecs'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { usePose } from '$lib/hooks/usePose.svelte'
	import { matrixToPose, poseToMatrix } from '$lib/transform'

	interface Props {
		entity: Entity
		children: Snippet<[{ pose: Pose | undefined }]>
	}
	let { entity, children }: Props = $props()

	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const editedPose = useTrait(() => entity, traits.EditedPose)
	const entityPose = useTrait(() => entity, traits.Pose)
	const snapshot = useTrait(() => entity, traits.EditEntrySnapshot)

	const pose = usePose(
		() => name.current,
		() => parent.current
	)

	// On the monitor → edit transition, copy the live (kinematics-resolved)
	// pose into EditedPose. Edit-mode rendering reads EditedPose directly, so
	// this preserves the robot's last-known position instead of snapping back
	// to the static config. The snapshot marker tracks "we entered edit mode
	// for this entity and have copied"; cleared once we're back in monitor
	// mode AND the post-save catch-up has settled, at which point useFrames
	// re-syncs EditedPose from the (now-current) network values.
	$effect.pre(() => {
		const mode = environment.current.viewerMode
		const pendingSave = partConfig.hasPendingSave

		if (mode === 'edit') {
			if (entity.has(traits.EditEntrySnapshot)) return

			const live = pose.current
			if (live) {
				entity.set(traits.EditedPose, live)
			}
			entity.add(traits.EditEntrySnapshot)
			return
		}

		if (!pendingSave && entity.has(traits.EditEntrySnapshot)) {
			entity.remove(traits.EditEntrySnapshot)
		}
	})

	const resolvedPose = $derived.by(() => {
		// Edit mode (or post-save catch-up): EditedPose was seeded from the live
		// pose at edit entry and is updated in place by gizmo drags, so it's
		// already the right value to render. Skip the live blend.
		if (snapshot.current) return editedPose.current

		if (pose.current === undefined) return editedPose.current
		if (!entityPose.current || !editedPose.current) return undefined

		const poseNetwork = poseToMatrix(entityPose.current)
		const poseLive = poseToMatrix(pose.current)
		const poseEdited = poseToMatrix(editedPose.current)
		return matrixToPose(poseLive.multiply(poseNetwork.invert()).multiply(poseEdited))
	})
</script>

{@render children({ pose: resolvedPose })}
