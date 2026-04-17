<script lang="ts">
	import type { Pose } from '@viamrobotics/sdk'
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { traits, useTrait } from '$lib/ecs'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { usePose } from '$lib/hooks/usePose.svelte'
	import { matrixToPose, poseToMatrix } from '$lib/transform'

	interface Props {
		entity: Entity
		children: Snippet<[{ pose: Pose | undefined }]>
	}
	let { entity, children }: Props = $props()

	const partConfig = usePartConfig()
	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const editedPose = useTrait(() => entity, traits.EditedPose)
	const entityPose = useTrait(() => entity, traits.Pose)

	const pose = usePose(
		() => name.current,
		() => parent.current
	)

	const resolvedPose = $derived.by(() => {
		if (pose.current === undefined || partConfig.hasPendingSave) {
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

{@render children({ pose: resolvedPose })}
