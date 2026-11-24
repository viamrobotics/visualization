<script lang="ts">
	import { mdiInformationOutline } from '@mdi/js'
	import { Collapsible, Icon, Switch, Tooltip } from '@viamrobotics/prime-ui'

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

<Collapsible bind:open>
	<Collapsible.Trigger>
		<strong class="font-semibold">obstacle</strong>
	</Collapsible.Trigger>

	<Collapsible.Content>
		<div class="flex flex-col gap-2 pt-2">
			<div class="flex flex-col gap-1">
				<div class="flex items-center justify-between gap-2">
					<span class="flex items-center gap-1">
						Preview on machine
						<Tooltip>
							<Tooltip.Trigger>
								<button
									type="button"
									class="text-subtle-2 hover:text-default flex"
									aria-label="About preview on machine"
								>
									<Icon icon={mdiInformationOutline} />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Content side="top">
								While on, the running machine plans around your unsaved edits to this obstacle,
								before you save. Your saved config is not changed. Turning this off, or leaving
								Build mode, switches the machine back to the last saved shape.
							</Tooltip.Content>
						</Tooltip>
					</span>
					<Switch
						aria-label="Preview on machine"
						disabled={unavailableReason !== undefined}
						bind:checked={
							() => preview.isEnabled,
							(next) => {
								preview.isEnabled = next
							}
						}
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
	</Collapsible.Content>
</Collapsible>
