<script lang="ts">
	import { traits, useTrait } from '$lib/ecs'
	import { usePose } from '$lib/hooks/usePose.svelte'
	import { matrixToPose, poseToMatrix } from '$lib/transform'
	import type { Pose } from '@viamrobotics/sdk'
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

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

	const finalPose = $derived.by(() => {
		if (pose.current === undefined) {
			return editedPose.current
		}

		if (!entityPose.current || !editedPose.current) {
			return
		}

		const poseNetwork = poseToMatrix(entityPose.current)
		const poseUsePose = poseToMatrix(pose.current)
		const poseLocalEditedPose = poseToMatrix(editedPose.current)

		const poseNetworkInverse = poseNetwork.invert()
		const resultMatrix = poseUsePose.multiply(poseNetworkInverse).multiply(poseLocalEditedPose)
		return matrixToPose(resultMatrix)
	})
</script>

{@render children({ pose: finalPose })}
