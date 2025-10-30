<script lang="ts">
	import { TransformControls } from '@threlte/extras'
	import { useSelected } from '$lib/hooks/useSelection.svelte'
	import { useStaticGeometries } from '$lib/hooks/useStaticGeometries.svelte'
	import { useTransformControls } from '$lib/hooks/useControls.svelte'
	import { PressedKeys } from 'runed'
	import { quaternionToPose, scaleToDimensions, vector3ToPose } from '$lib/transform'
	import { Quaternion, Vector3 } from 'three'
	import Frame from './Frame.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()
	const transformControls = useTransformControls()
	const geometries = useStaticGeometries()
	const selected = useSelected()

	const mode = $derived(settings.current.transformMode)

	const quaternion = new Quaternion()
	const vector3 = new Vector3()

	const keys = new PressedKeys()

	keys.onKeys('=', () => geometries.add())
	keys.onKeys('-', () => geometries.remove(selected.current ?? ''))

	$effect(() => {
		settings.current.transforming = geometries.current.some(
			(geometry) => selected.current === geometry.uuid
		)
	})
</script>

{#each geometries.current as object (object.uuid)}
	<Frame
		uuid={object.uuid}
		name={object.name}
		pose={object.pose}
		geometry={object.geometry}
		metadata={object.metadata}
	>
		{#snippet children({ ref })}
			{#if selected.current === object.uuid}
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

							if (mode === 'translate') {
								vector3ToPose(ref.getWorldPosition(vector3), object.pose)
							} else if (mode === 'rotate') {
								quaternionToPose(ref.getWorldQuaternion(quaternion), object.pose)
								ref.quaternion.copy(quaternion)
							} else if (mode === 'scale' && object.geometry?.geometryType.case === 'box') {
								scaleToDimensions(ref.scale, object.geometry.geometryType)
								ref.scale.setScalar(1)
							}

							object.pose = { ...object.pose }
							object.geometry = { ...object.geometry }
						}}
					/>
				{/key}
			{/if}
		{/snippet}
	</Frame>
{/each}
