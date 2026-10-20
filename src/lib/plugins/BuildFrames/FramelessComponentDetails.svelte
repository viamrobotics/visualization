<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { Button } from '@viamrobotics/prime-core'
	import { type Entity } from 'koota'

	import DetailsPanel from '$lib/components/overlay/details/DetailsPanel.svelte'
	import { traits, useTrait } from '$lib/ecs'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		entity: Entity
	}

	const { entity, ...rest }: Props = $props()

	const partConfig = usePartConfig()

	const name = useTrait(() => entity, traits.Name)
</script>

<DetailsPanel
	{entity}
	sceneActions={false}
	{...rest}
>
	<p class="text-subtle-1 pt-3 pb-2">This component has no frame, so it isn't in the scene.</p>

	<Button
		icon="plus"
		class="w-full"
		onclick={() => {
			if (name.current) partConfig.createFrame(name.current)
		}}
	>
		Add frame
	</Button>
</DetailsPanel>
