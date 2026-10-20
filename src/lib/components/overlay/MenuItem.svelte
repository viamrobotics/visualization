<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements'

	import { Icon, type IconName } from '@viamrobotics/prime-core'

	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		/** The item's accessible name. */
		label: string
		/** One line under the label, announced as the item's description. */
		description?: string
		/** Drawn in a tile before the text. */
		icon?: IconName
		/** The item swaps the menu to another screen, so it gets a trailing chevron. */
		opensSubmenu?: boolean
		/** The rendered button, for a caller that moves focus to it. */
		ref?: HTMLButtonElement
	}

	let {
		label,
		description,
		icon,
		opensSubmenu = false,
		ref = $bindable(),
		...rest
	}: Props = $props()

	const id = $props.id()
</script>

<button
	bind:this={ref}
	type="button"
	role="menuitem"
	aria-haspopup={opensSubmenu ? 'menu' : undefined}
	aria-labelledby="{id}-label"
	aria-describedby={description ? `${id}-description` : undefined}
	class="hover:bg-light focus-visible:bg-light active:bg-medium flex w-full cursor-pointer items-start gap-3 px-3 py-1.5 text-left"
	{...rest}
>
	{#if icon}
		<span
			class="bg-light text-gray-6 flex size-9 shrink-0 items-center justify-center mix-blend-multiply"
			aria-hidden="true"
		>
			<Icon name={icon} />
		</span>
	{/if}

	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span
			id="{id}-label"
			class="text-default text-xs font-medium"
		>
			{label}
		</span>
		{#if description}
			<span
				id="{id}-description"
				class="text-subtle-2 text-xs"
			>
				{description}
			</span>
		{/if}
	</span>

	{#if opensSubmenu}
		<span
			class="text-subtle-2 self-center"
			aria-hidden="true"
		>
			<Icon name="chevron-right" />
		</span>
	{/if}
</button>
