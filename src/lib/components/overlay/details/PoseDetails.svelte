<script lang="ts">
	import type { Entity } from 'koota'

	import EntityLink from '../EntityLink.svelte'
	import SharedPoseFields from './SharedPoseFields.svelte'
	import { MIXED, MIXED_TEXT } from './sharedValue'
	import { useSharedPose } from './useSharedPose.svelte'
	import WorldPoseDetails from './WorldPoseDetails.svelte'

	interface Props {
		/** The selection. Never empty. */
		entities: readonly Entity[]
	}

	const { entities }: Props = $props()

	const pose = useSharedPose(() => entities)
</script>

<WorldPoseDetails pose={pose.worldPose} />

<div>
	<strong class="font-semibold">parent frame</strong>
	<div class="mt-0.5 flex gap-3">
		{#if pose.parentEntity !== MIXED && pose.parentEntity}
			<EntityLink entity={pose.parentEntity} />
		{:else}
			<div>
				<span
					class="text-subtle-2"
					aria-label="immutable parent frame name"
				></span>

				{pose.parentName === MIXED ? MIXED_TEXT : pose.parentName}
			</div>
		{/if}
	</div>
</div>

<SharedPoseFields
	poses={pose.localPoses}
	editable={false}
	onchange={() => {}}
/>
