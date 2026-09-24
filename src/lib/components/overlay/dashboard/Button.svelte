<script lang="ts">
	import type { ClassValue, HTMLButtonAttributes, MouseEventHandler } from 'svelte/elements'

	import { Icon, type IconName } from '@viamrobotics/prime-core'
	import { Hammer, Joystick, MousePointer2, Move3d, Ruler, Shapes } from 'lucide-svelte'

	import Tooltip from '../Tooltip.svelte'

	interface Props extends HTMLButtonAttributes {
		icon: IconName | 'ruler' | 'mouse-pointer' | 'shapes' | 'hammer' | 'move-3d'
		iconCx?: string
		active?: boolean
		description: string
		hotkey?: string
		class?: ClassValue | null | undefined
		tooltipLocation?: 'bottom' | 'right' | 'left' | 'top'
		disableTooltip?: boolean
		onclick?: MouseEventHandler<HTMLButtonElement> | null | undefined
	}

	let {
		icon,
		iconCx,
		active = false,
		description,
		hotkey = '',
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
				'relative block rounded-md border active:z-4 active:border-[#666] active:bg-[#666] active:text-white',
				active ? 'z-4 border-[#666] bg-[#666] text-white' : 'border-gray-5 text-gray-8 bg-white',
			]}
			aria-describedby={tooltipID}
		>
			<button
				class=" p-1.5"
				role="radio"
				aria-label={description}
				aria-checked={active}
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
				{:else if icon === 'joystick'}
					<Joystick size="16" />
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
		{description} <span class="text-gray-5 pl-1">{hotkey}</span>
	{/snippet}
</Tooltip>
