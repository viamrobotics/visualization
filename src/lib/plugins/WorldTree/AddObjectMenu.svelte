<script lang="ts">
	import { Icon } from '@viamrobotics/prime-core'
	import { tick } from 'svelte'

	import MenuItem from '$lib/components/overlay/MenuItem.svelte'
	import Popover from '$lib/components/overlay/Popover.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	import NewObstacleDialog from './NewObstacleDialog.svelte'
	import {
		OBSTACLE_TYPE_OPTIONS,
		OBSTACLE_TYPE_ORDER,
		type ObstacleType,
	} from './obstacleTypeOptions'
	import WorldTreeAddButton from './WorldTreeAddButton.svelte'

	const partConfig = usePartConfig()

	// Every object here is written to the part config. With no config to write to,
	// creating one would replace the machine's components with just the new one.
	const canEditConfig = $derived(partConfig.isReady && partConfig.hasEditPermissions)

	let isObstacleDialogOpen = $state(false)
	let obstacleType = $state<ObstacleType>('simple')

	/** Which screen of the menu is showing. Picking Obstacle swaps in its types, with a way back. */
	let screen = $state<'objects' | 'obstacle-types'>('objects')

	let obstacleItem = $state<HTMLButtonElement>()
	const obstacleTypeItems = $state<HTMLButtonElement[]>([])

	// The item that opened a screen is gone once it swaps, so focus moves to the new screen's first item.
	const showScreen = (next: typeof screen) => {
		screen = next
		void tick().then(() => {
			const target = next === 'objects' ? obstacleItem : obstacleTypeItems[0]
			target?.focus()
		})
	}

	const headingId = $props.id()
	const obstacleHeadingId = `${headingId}-obstacle`
</script>

{#if canEditConfig}
	<!--
		Portalled rather than floated in place: the panel header is `sticky`, which
		is its own stacking context, so a menu rendered inside it paints under the
		filter bar no matter how high its z-index goes.
	-->
	<Popover
		placement="right-start"
		onOpenChange={(open) => {
			if (open) screen = 'objects'
		}}
	>
		{#snippet trigger(triggerProps, { isOpen })}
			<WorldTreeAddButton
				{...triggerProps}
				label="Add object"
				{isOpen}
			/>
		{/snippet}

		{#snippet children({ close })}
			{#if screen === 'objects'}
				<div
					role="menu"
					aria-labelledby={headingId}
					class="font-public-sans w-70 pt-1.5 pb-1"
				>
					<p
						id={headingId}
						class="text-subtle-2 px-3 py-0.5 text-xs"
					>
						Add
					</p>

					<hr class="border-light mt-1.5 mb-1.5 shadow-none" />

					<MenuItem
						bind:ref={obstacleItem}
						icon="viam-component"
						label="Obstacle"
						description="A generic component with geometry that motion planning avoids"
						opensSubmenu
						onclick={() => showScreen('obstacle-types')}
					/>
				</div>
			{:else}
				<div
					role="menu"
					aria-labelledby={obstacleHeadingId}
					class="font-public-sans w-70 pt-1.5 pb-1"
				>
					<div class="flex items-center gap-1 px-1.5">
						<button
							type="button"
							role="menuitem"
							aria-label="Back"
							class="text-gray-7 hover:bg-ghost-light focus-visible:outline-gray-6 grid size-6 cursor-pointer place-content-center focus-visible:outline focus-visible:-outline-offset-1"
							onclick={() => showScreen('objects')}
						>
							<Icon name="chevron-left" />
						</button>
						<p
							id={obstacleHeadingId}
							class="text-subtle-2 text-xs"
						>
							Obstacle
						</p>
					</div>

					<hr class="border-light mt-1.5 mb-1.5 shadow-none" />

					{#each OBSTACLE_TYPE_ORDER as type, index (type)}
						{@const option = OBSTACLE_TYPE_OPTIONS[type]}
						<MenuItem
							bind:ref={obstacleTypeItems[index]}
							label={option.label}
							description={option.description}
							onclick={() => {
								close()
								obstacleType = type
								isObstacleDialogOpen = true
							}}
						/>
					{/each}
				</div>
			{/if}
		{/snippet}
	</Popover>
{:else}
	<button
		type="button"
		aria-disabled="true"
		aria-label="Add object"
		title={partConfig.error ?? 'This machine’s configuration is not editable here.'}
		class="text-disabled grid size-7 cursor-not-allowed place-content-center"
	>
		<Icon name="plus" />
	</button>
{/if}

<NewObstacleDialog
	bind:open={isObstacleDialogOpen}
	type={obstacleType}
/>
