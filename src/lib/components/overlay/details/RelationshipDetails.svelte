<script lang="ts">
	import { Icon } from '@viamrobotics/prime-core'
	import { type Entity } from 'koota'

	import { relations, traits } from '$lib/ecs'
	import { useLinkedEntities } from '$lib/hooks/useLinked.svelte'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const linkedEntities = useLinkedEntities()
</script>

{#if linkedEntities.current.length > 0}
	<h3 class="text-subtle-2 pt-3 pb-2">Relationships</h3>

	<div class="mt-0.5 flex flex-col gap-1">
		<strong class="font-semibold">Linked entities</strong>
		{#each linkedEntities.current as linkedEntity (linkedEntity)}
			{@const linkedEntityName = linkedEntity.get(traits.Name)}
			{@const linkType = entity.get(relations.SubEntityLink(linkedEntity))?.type}
			<div class="flex items-center gap-1">
				<span class="text-primary">{linkedEntityName} ({linkType})</span>
				<Icon
					name="trash-can-outline"
					class="h-6 cursor-pointer px-2 py-1 text-xs text-red-500"
					onclick={() => entity.remove(relations.SubEntityLink(linkedEntity))}
				/>
			</div>
		{/each}
	</div>
{/if}
