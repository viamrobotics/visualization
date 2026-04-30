<script lang="ts">
	import type { Pose } from '@viamrobotics/sdk'
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { traits, useTrait } from '$lib/ecs'
	import { usePose } from '$lib/hooks/usePose.svelte'
	import { composeRenderedPose } from '$lib/transform'

	interface Props {
		entity: Entity
		children: Snippet<[{ pose: Pose | undefined }]>
	}
	let { entity, children }: Props = $props()

	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const editedPose = useTrait(() => entity, traits.EditedPose)
	const entityPose = useTrait(() => entity, traits.Pose)

	const pose = usePose(
		() => name.current,
		() => parent.current
	)

	$effect.pre(() => {
		if (pose.current === undefined) return

		if (entity.has(traits.LivePose)) {
			entity.set(traits.LivePose, pose.current)
		} else {
			entity.add(traits.LivePose(pose.current))
		}
	})

	// Always render through the live blend: live × network⁻¹ × edited. With
	// `edited === network` (no edits) this collapses to `live`, so the rendered
	// pose tracks the robot's kinematics-resolved position. With edits, the
	// formula composes the staged delta on top of live. Input handlers that
	// drive edits (gizmo onChange, Details panel) compute `edited` such that
	// the blend renders to the user's intent.
	const resolvedPose = $derived.by(() => {
		if (pose.current === undefined) return editedPose.current
		if (!entityPose.current || !editedPose.current) return undefined

		return composeRenderedPose(pose.current, entityPose.current, editedPose.current)
	})
</script>

{@render children({ pose: resolvedPose })}
