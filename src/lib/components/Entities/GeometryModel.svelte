<script lang="ts">
	import { Group } from 'three'
	import { T, useThrelte } from '@threlte/core'
	import { traits, useTrait } from '$lib/ecs'
	import { use3DModels } from '$lib/hooks/use3DModels.svelte'
	import { Portal } from '@threlte/extras'
	import { poseToObject3d } from '$lib/transform'

	const { entity } = $props()

	const { invalidate } = useThrelte()
	const models = use3DModels()
	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const pose = useTrait(() => entity, traits.Pose)
	const center = useTrait(() => entity, traits.Center)

	const outerGroup = new Group()
	const innerGroup = new Group()

	const model = $derived.by(() => {
		if (!name.current) {
			return
		}

		const [componentName, id] = name.current.split(':')
		if (!componentName || !id) {
			return
		}

		return models.current[componentName]?.[id].clone()
	})

	$effect.pre(() => {
		if (pose.current) {
			poseToObject3d(pose.current, outerGroup)
			invalidate()
		}
	})

	$effect.pre(() => {
		if (center.current) {
			poseToObject3d(center.current, innerGroup)
			invalidate()
		}
	})
</script>

{#if model}
	<Portal id={parent.current}>
		<T is={outerGroup}>
			<T is={innerGroup}>
				<T is={model} />
			</T>
		</T>
	</Portal>
{/if}
