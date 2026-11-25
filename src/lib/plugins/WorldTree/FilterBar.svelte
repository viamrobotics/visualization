<script lang="ts">
	import { mdiClose, mdiMagnify } from '@mdi/js'
	import { TextField } from '@viamrobotics/prime-controls'
	import { Icon } from '@viamrobotics/prime-ui'

	interface Props {
		/** Bound so the clear button and the tree read one query. */
		value: string
	}

	let { value = $bindable() }: Props = $props()
</script>

<div class="flex shrink-0 items-center gap-2 px-2 py-1">
	<Icon
		icon={mdiMagnify}
		size="sm"
		class="text-gray-6 shrink-0"
	/>

	<TextField
		bind:value
		aria-label="Filter objects"
		placeholder="Filter"
		class="min-w-0 grow"
		onkeydown={(event) => {
			// The camera's key bindings listen on `window`, so typing `wasd` here would
			// fly the camera without this.
			event.stopPropagation()

			if (event.key === 'Escape') value = ''
		}}
	/>

	{#if value !== ''}
		<button
			type="button"
			aria-label="Clear filter"
			class="text-subtle-2 hover:text-default hover:bg-ghost-light focus-visible:outline-gray-6 shrink-0 cursor-pointer rounded-xs p-1.5 focus-visible:outline focus-visible:-outline-offset-1"
			onclick={() => {
				value = ''
			}}
		>
			<Icon
				icon={mdiClose}
				size="sm"
			/>
		</button>
	{/if}
</div>
