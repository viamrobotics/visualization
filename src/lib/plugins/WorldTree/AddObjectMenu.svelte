<script lang="ts">
	import { Icon } from '@viamrobotics/prime-core'

	import Popover from '$lib/components/overlay/Popover.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	import NewObstacleDialog from './NewObstacleDialog.svelte'

	const partConfig = usePartConfig()

	// Every object here is written to the part config. With no config to write to,
	// creating one would replace the machine's components with just the new one.
	const canEditConfig = $derived(partConfig.isReady && partConfig.hasEditPermissions)

	let isObstacleDialogOpen = $state(false)

	const headingId = $props.id()
</script>

{#if canEditConfig}
	<!--
		Portalled rather than floated in place: the panel header is `sticky`, which
		is its own stacking context, so a menu rendered inside it paints under the
		filter bar no matter how high its z-index goes.
	-->
	<Popover placement="right-start">
		{#snippet trigger(triggerProps, { isOpen })}
			<button
				{...triggerProps}
				type="button"
				aria-label="Add object"
				class={[
					'-m-1 grid size-7 cursor-pointer place-content-center transition-colors',
					isOpen ? 'bg-ghost-light text-gray-7' : 'text-gray-7 hover:bg-ghost-light',
					'focus-visible:outline-gray-6 focus-visible:outline focus-visible:-outline-offset-1',
				]}
			>
				<Icon name="plus" />
			</button>
		{/snippet}

		{#snippet children({ close })}
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

				<button
					type="button"
					role="menuitem"
					class="hover:bg-light focus-visible:bg-light active:bg-medium flex w-full cursor-pointer items-start gap-3 px-3 py-1.5 text-left"
					onclick={() => {
						close()
						isObstacleDialogOpen = true
					}}
				>
					<span
						class="bg-light text-gray-6 flex size-9 shrink-0 items-center justify-center mix-blend-multiply"
					>
						<Icon name="viam-component" />
					</span>

					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="text-default text-xs font-medium">Obstacle</span>
						<span class="text-subtle-2 text-xs">
							A generic component with geometry that motion planning avoids
						</span>
					</span>
				</button>
			</div>
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

<NewObstacleDialog bind:open={isObstacleDialogOpen} />
