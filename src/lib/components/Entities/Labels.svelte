<script lang="ts">
	import { useTask, useThrelte } from '@threlte/core'

	import { traits, useQuery } from '$lib/ecs'

	import Label from './Label.svelte'
	import { createLabelLayout } from './labelLayout/createLabelLayout'
	import { labels } from './labelLayout/labelStore.svelte'

	const { camera, invalidate, size } = useThrelte()

	const entities = useQuery(traits.Name, traits.WorldMatrix)

	const layout = createLabelLayout({ camera, size, invalidate, labels })

	// Wake the on-demand render loop when labels are added/removed or their text
	// changes, so the engine re-solves even while the camera is still. Reading
	// `version` registers the reactive dependency.
	$effect(() => {
		if (labels.version >= 0) invalidate()
	})

	// `autoInvalidate: false` — the engine drives its own invalidation (camera
	// motion, the version effect above, and while animating), so the task can run
	// without pinning the on-demand Canvas to render every frame.
	useTask(
		(delta) => {
			layout.frame(delta)
		},
		{ autoInvalidate: false }
	)
</script>

{#each entities.current as entity (entity)}
	<Label {entity} />
{/each}
