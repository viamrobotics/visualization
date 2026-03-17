<!--
@component

Renders a Viam Geometry object
-->
<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { T, useThrelte } from '@threlte/core'
	import { Portal } from '@threlte/extras'

	import { traits, useTrait } from '$lib/ecs'
	import { use3DModels } from '$lib/hooks/use3DModels.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { poseToObject3d } from '$lib/transform'

	import { useEntityEvents } from './hooks/useEntityEvents.svelte'
	import Mesh from './Mesh.svelte'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	const { entity, children }: Props = $props()

	const settings = useSettings()

	const { invalidate } = useThrelte()
	const models = use3DModels()

	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const center = useTrait(() => entity, traits.Center)

	const model = $derived.by(() => {
		if (!settings.current.renderArmModels.includes('model')) {
			return
		}

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
		if (model && center.current) {
			poseToObject3d(center.current, model)
			invalidate()
		}
	})

	const events = useEntityEvents(() => entity)
</script>

<Portal id={parent.current}>
	{#if model}
		<T is={model} />
	{/if}

	{#if settings.current.renderArmModels.includes('colliders') || !model}
		<Mesh
			{entity}
			center={center.current}
			{...events}
		>
			{@render children?.()}
		</Mesh>
	{/if}
</Portal>
