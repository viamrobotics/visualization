<script lang="ts">
	import type { ClassValue, HTMLButtonAttributes, MouseEventHandler } from 'svelte/elements'

	import { Icon, type IconName } from '@viamrobotics/prime-core'
	import { Hammer, MousePointer2, Move3d, Ruler, Shapes } from 'lucide-svelte'

	import type { Keybinding } from '#lib/keybindings/index.js'

	import Kbd from '../Kbd.svelte'
	import Tooltip from '../Tooltip.svelte'

	interface Props extends HTMLButtonAttributes {
		icon: IconName | 'ruler' | 'mouse-pointer' | 'shapes' | 'hammer' | 'move-3d'
		iconCx?: string
		/** Pressed state of a toggle. Leave unset for a plain action, so it isn't announced as a toggle. */
		active?: boolean
		description: string
		keybinding?: Keybinding
		class?: ClassValue | null | undefined
		tooltipLocation?: 'bottom' | 'right' | 'left' | 'top'
		disableTooltip?: boolean
		onclick?: MouseEventHandler<HTMLButtonElement> | null | undefined
	}

	let {
		icon,
		iconCx,
		active,
		description,
		keybinding,
		class: className = '',
		tooltipLocation,
		disableTooltip = false,
		onclick,
		...rest
	}: Props = $props()
</script>

<Tooltip
	placement={tooltipLocation ?? 'bottom'}
	disabled={disableTooltip}
>
	{#snippet children(tooltipID)}
		<label
			class={[
				className,
				'relative block rounded-md border',
				active
					? 'border-gray-8 bg-gray-8 z-4 text-white'
					: 'border-gray-5 text-gray-8 not-has-disabled:hover:bg-light not-has-disabled:active:bg-medium bg-white',
				'has-disabled:text-disabled has-disabled:cursor-not-allowed',
			]}
			aria-describedby={tooltipID}
		>
			<button
				class="p-1.5 disabled:cursor-not-allowed"
				aria-label={description}
				aria-pressed={active}
				{onclick}
				{...rest}
			>
				{#if icon === 'ruler'}
					<Ruler size="16" />
				{:else if icon === 'mouse-pointer'}
					<MousePointer2 size="16" />
				{:else if icon === 'shapes'}
					<Shapes size="16" />
				{:else if icon === 'hammer'}
					<Hammer size="16" />
				{:else if icon === 'move-3d'}
					<Move3d size="16" />
				{:else}
					<Icon
						name={icon}
						cx={iconCx}
					/>
				{/if}
			</button>
		</label>
	{/snippet}

	{#snippet content()}
		{description}

		{#if keybinding}
			<span class="pl-1"><Kbd binding={keybinding} /></span>
		{/if}
	{/snippet}
</Tooltip>
