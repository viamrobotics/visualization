<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { Button } from '@viamrobotics/prime-core'
	import { type Entity } from 'koota'

	import DetailsPanel from '#lib/components/overlay/details/DetailsPanel.svelte'
	import { traits } from '#lib/ecs/index.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** The selected components without a frame. Never empty. */
		entities: readonly Entity[]
	}

	const { entities, ...rest }: Props = $props()

	const partConfig = usePartConfig()

	const isSingle = $derived(entities.length === 1)
</script>

<DetailsPanel
	{entities}
	sceneActions={false}
	{...rest}
>
	<div class="bg-extralight px-2 pb-2">
		<p class="text-subtle-1 pt-3 pb-2">
			{isSingle
				? "This component has no frame, so it isn't in the scene."
				: "These components have no frame, so they aren't in the scene."}
		</p>

		<Button
			icon="plus"
			class="w-full"
			onclick={() => {
				for (const entity of entities) {
					const name = entity.get(traits.Name)
					if (name) partConfig.createFrame(name)
				}
			}}
		>
			{isSingle ? 'Add frame' : `Add ${entities.length} frames`}
		</Button>
	</div>
</DetailsPanel>
