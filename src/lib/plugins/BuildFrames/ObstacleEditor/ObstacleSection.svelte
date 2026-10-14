<script lang="ts">
	import { Expandable, Icon } from '@viamrobotics/prime-core'

	import ObstacleEditor from './ObstacleEditor.svelte'

	interface Props {
		/** Name of the part-owned obstacle component to edit. */
		name: string
	}

	const { name }: Props = $props()

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
	<div class="pt-2">
		<ObstacleEditor {name} />
	</div>
{/snippet}

<Expandable
	bind:open
	{trigger}
	{content}
	triggerClass="w-full text-left"
/>
