<script lang="ts">
	import { Icon } from '@viamrobotics/prime-core'

	interface Props {
		/** Bound so the clear button and the tree read one query. */
		value: string
	}

	let { value = $bindable() }: Props = $props()
</script>

<div
	class="group bg-light focus-within:bg-medium flex shrink-0 items-center gap-1.5 pr-1 pl-2 transition-colors"
>
	<Icon
		name="magnify"
		size="sm"
		cx="text-subtle-2 group-focus-within:text-subtle-1 shrink-0 transition-colors"
	/>

	<input
		bind:value
		type="text"
		aria-label="Filter objects"
		placeholder="Filter"
		class="text-default placeholder:text-subtle-2 h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-xs outline-none focus:shadow-none focus:ring-0"
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
				name="close"
				size="sm"
			/>
		</button>
	{/if}
</div>
