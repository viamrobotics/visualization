<!--
@component

Renders a Viam Geometry object
-->
<script lang="ts">
	import { Group } from 'three'
	import { T, useThrelte } from '@threlte/core'
	import { traits, useTrait } from '$lib/ecs'
	import { use3DModels } from '$lib/hooks/use3DModels.svelte'
	import { Portal } from '@threlte/extras'
	import { poseToObject3d } from '$lib/transform'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import Mesh from './Mesh.svelte'
	import { useEntityEvents } from './hooks/useEntityEvents.svelte'
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

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

	const group = new Group()

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
		if (center.current) {
			poseToObject3d(center.current, group)
			invalidate()
		}
	})

	const events = useEntityEvents(() => entity)
</script>

<Portal id={parent.current}>
	<T is={group}>
		{#if model}
			<T is={model} />
		{/if}

		{#if settings.current.renderArmModels.includes('colliders') || !model}
			<Mesh
				{entity}
				{...events}
			>
				{@render children?.()}
			</Mesh>
		{/if}
	</T>
</Portal>
