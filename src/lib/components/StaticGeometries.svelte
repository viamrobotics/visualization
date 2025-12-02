<script
	module
	lang="ts"
>
	let index = 0
</script>

<script lang="ts">
	import { TransformControls } from '@threlte/extras'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import { PressedKeys } from 'runed'
	import { quaternionToPose, vector3ToPose } from '$lib/transform'
	import { Quaternion, Vector3 } from 'three'
	import Frame from './Frame.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useWorld, traits } from '$lib/ecs'
	import type { Entity } from 'koota'
	import { SvelteSet } from 'svelte/reactivity'

	const world = useWorld()
	const settings = useSettings()
	const transformControls = useTransformControls()
	const selectedEntity = useSelectedEntity()

	const entities = new SvelteSet<Entity>()
	const selectedCustomGeometry = $derived(
		[...entities].find(
			(entity) => entity.get(traits.UUID) === selectedEntity.current?.get(traits.UUID)
		)
	)

	const mode = $derived(settings.current.transformMode)

	const quaternion = new Quaternion()
	const vector3 = new Vector3()

	const keys = new PressedKeys()

	keys.onKeys('=', () => {
		const entity = world.spawn(
			traits.UUID,
			traits.Name(`custom geometry ${++index}`),
			traits.Pose,
			traits.Box({ x: 0.1, y: 0.1, z: 0.1 })
		)

		entities.add(entity)
	})

	keys.onKeys('-', () => {
		if (selectedCustomGeometry) {
			selectedCustomGeometry.destroy()
			entities.delete(selectedCustomGeometry)
			selectedEntity.set()
		}
	})

	$effect(() => {
		settings.current.transforming = selectedCustomGeometry !== undefined
	})
</script>

{#each entities as entity (entity)}
	<Frame {entity}>
		{#snippet children({ ref })}
			{#if selectedEntity.current === entity}
				{#key mode}
					<TransformControls
						object={ref}
						{mode}
						translationSnap={settings.current.snapping ? 0.1 : undefined}
						rotationSnap={settings.current.snapping ? Math.PI / 24 : undefined}
						scaleSnap={settings.current.snapping ? 0.1 : undefined}
						onmouseDown={() => {
							transformControls.setActive(true)
						}}
						onmouseUp={() => {
							transformControls.setActive(false)

							const pose = entity.get(traits.Pose)
							const box = entity.get(traits.Box)

							if (pose && mode === 'translate') {
								vector3ToPose(ref.getWorldPosition(vector3), pose)
								entity.set(traits.Pose, pose)
							} else if (pose && mode === 'rotate') {
								quaternionToPose(ref.getWorldQuaternion(quaternion), pose)
								ref.quaternion.copy(quaternion)
								entity.set(traits.Pose, pose)
							} else if (box && mode === 'scale') {
								entity.set(traits.Box, ref.scale)
								ref.scale.setScalar(1)
							}
						}}
					/>
				{/key}
			{/if}
		{/snippet}
	</Frame>
{/each}
