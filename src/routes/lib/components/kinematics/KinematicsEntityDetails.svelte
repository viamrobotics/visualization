<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { Button } from '@viamrobotics/prime-core'
	import { type Entity } from 'koota'

	import type { DetailsTab } from '$lib/components/overlay/details/DetailsTabs.svelte'

	import AppearanceDetails from '$lib/components/overlay/details/AppearanceDetails.svelte'
	import DetailsPanel from '$lib/components/overlay/details/DetailsPanel.svelte'
	import DetailsTabs from '$lib/components/overlay/details/DetailsTabs.svelte'
	import { traits, useTrait } from '$lib/ecs'

	import type { KinematicsWorkbench } from '../../kinematics/kinematicsWorkbench.svelte'

	import { kinematicsItem } from '../../kinematics/kinematicsItem'
	import KinematicsJointDetails from './KinematicsJointDetails.svelte'
	import KinematicsLinkDetails from './KinematicsLinkDetails.svelte'
	import KinematicsModelDetails from './KinematicsModelDetails.svelte'
	import KinematicsTcpDetails from './KinematicsTcpDetails.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		entity: Entity
		workbench: KinematicsWorkbench
		/** Selects the entity with this name once it exists. */
		select: (name: string) => void
	}

	const { entity, workbench, select, ...rest }: Props = $props()

	const name = useTrait(() => entity, traits.Name)

	const item = $derived(
		name.current === undefined ? undefined : kinematicsItem(workbench.spec, name.current)
	)

	const tabs = $derived<DetailsTab[]>([
		{ id: 'details', label: 'Details', content: detailsTab },
		{ id: 'appearance', label: 'Appearance', content: appearanceTab },
	])
</script>

{#snippet detailsTab()}
	{#if item?.kind === 'root'}
		<KinematicsModelDetails
			{workbench}
			{select}
		/>
	{:else if item?.kind === 'link'}
		<KinematicsLinkDetails
			{workbench}
			link={item.link}
			{select}
		/>
	{:else if item?.kind === 'joint'}
		<KinematicsJointDetails
			{workbench}
			joint={item.joint}
			{select}
		/>
	{:else if item?.kind === 'tcp'}
		<KinematicsTcpDetails {workbench} />
	{:else if item?.kind === 'visual'}
		{@const owner = item.link.id}
		<div class="flex flex-col gap-2.5 pt-3">
			<p class="text-subtle-1 text-xs">
				Visual mesh of link {owner}. Preview only, the robot never receives it.
			</p>
			<Button
				variant="ghost-outline"
				class="w-full"
				onclick={() => select(owner)}
			>
				Select link {owner}
			</Button>
		</div>
	{/if}
{/snippet}

{#snippet appearanceTab()}
	<AppearanceDetails {entity} />
{/snippet}

{#if item}
	<DetailsPanel
		{entity}
		{...rest}
	>
		<!-- A link's details outgrow a short window, and the shared panel does not scroll on its own. -->
		<div class="-mx-2 max-h-[calc(100dvh-9rem)] overflow-y-auto px-2">
			<DetailsTabs items={tabs} />
		</div>
	</DetailsPanel>
{/if}
