<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements'

	import { Icon } from '@viamrobotics/prime-core'

	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		/** The button's accessible name. */
		label: string
		/** Draws the pressed look while the menu it opens is showing. */
		isOpen?: boolean
	}

	const { label, isOpen = false, ...rest }: Props = $props()
</script>

<button
	{...rest}
	type="button"
	aria-label={label}
	class={[
		'-m-1 grid size-7 cursor-pointer place-content-center transition-colors',
		isOpen ? 'bg-ghost-light text-gray-7' : 'text-gray-7 hover:bg-ghost-light',
		'focus-visible:outline-gray-6 focus-visible:outline focus-visible:-outline-offset-1',
	]}
>
	<Icon name="plus" />
</button>
