<script lang="ts">
	import { Expandable, Icon, Switch } from '@viamrobotics/prime-core'

	import Tooltip from '#lib/components/overlay/Tooltip.svelte'

	import type { ObstaclePreviewToggle } from '../obstaclePreviewToggle.svelte'

	import ObstacleEditor from './ObstacleEditor.svelte'

	interface Props {
		/** Name of the part-owned obstacle component to edit. */
		name: string
		preview: ObstaclePreviewToggle
	}

	const { name, preview }: Props = $props()

	const unavailableReason = $derived(preview.unavailableReason(name))

	let open = $state(true)
</script>

{#snippet trigger({ isOpen }: { isOpen: boolean })}
	<span class="flex w-full items-center gap-1">
		<Icon
			name={isOpen ? 'chevron-down' : 'chevron-right'}
			aria-hidden="true"
		/>
		<strong class="font-semibold">obstacle</strong>
	</span>
{/snippet}

{#snippet content()}
	<div class="flex flex-col gap-2 pt-2">
		<div class="flex flex-col gap-1">
			<div class="flex items-center justify-between gap-2">
				<span class="flex items-center gap-1">
					Preview on machine
					<Tooltip placement="top">
						{#snippet children(tooltipID)}
							<button
								class="text-subtle-2 hover:text-default flex"
								aria-label="About preview on machine"
								aria-describedby={tooltipID}
							>
								<Icon
									name="information-outline"
									aria-hidden="true"
								/>
							</button>
						{/snippet}

						{#snippet content()}
							While on, the running machine plans around your unsaved edits to this obstacle, before
							you save. Your saved config is not changed. Turning this off, or leaving Build mode,
							switches the machine back to the last saved shape.
						{/snippet}
					</Tooltip>
				</span>
				<Switch
					aria-label="Preview on machine"
					on={preview.isEnabled}
					disabled={unavailableReason !== undefined}
					on:change={(event) => {
						preview.isEnabled = event.detail
					}}
				/>
			</div>
			{#if unavailableReason}
				<p class="text-subtle-2">{unavailableReason}</p>
			{:else if preview.isEnabled}
				<p class="text-subtle-2">The running machine is planning around this unsaved shape.</p>
			{/if}
		</div>

		<ObstacleEditor {name} />
	</div>
{/snippet}

<Expandable
	bind:open
	{trigger}
	{content}
	triggerClass="w-full text-left"
/>
