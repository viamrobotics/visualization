<script
	module
	lang="ts"
>
	import {
		mdiAxisArrow,
		mdiCamera,
		mdiCameraOutline,
		mdiChevronDown,
		mdiCog,
		mdiCropFree,
		mdiEarth,
		mdiImageFilterCenterFocus,
		mdiOpenInNew,
		mdiRobotOutline,
		mdiSelectionDrag,
		mdiSync,
		mdiTextBoxOutline,
		mdiTuneVariant,
	} from '@mdi/js'
	import { type IconType } from '@viamrobotics/prime-ui'
	import {
		CursorMove,
		GridOrthographic,
		GridPerspective,
		Magnet,
		MagnetOff,
		Resize,
	} from '@viamrobotics/prime-ui/icons'
	import { MousePointer2, Ruler } from 'lucide-svelte'

	const PRIME_ICONS = {
		article: mdiTextBoxOutline,
		'axis-arrow': mdiAxisArrow,
		camera: mdiCamera,
		'camera-outline': mdiCameraOutline,
		'chevron-down': mdiChevronDown,
		cog: mdiCog,
		'crop-free': mdiCropFree,
		'cursor-move': CursorMove,
		earth: mdiEarth,
		'filter-sliders': mdiTuneVariant,
		'grid-orthographic': GridOrthographic,
		'grid-perspective': GridPerspective,
		'image-filter-center-focus': mdiImageFilterCenterFocus,
		magnet: Magnet,
		'magnet-off': MagnetOff,
		'open-in-new': mdiOpenInNew,
		resize: Resize,
		'robot-outline': mdiRobotOutline,
		'selection-drag': mdiSelectionDrag,
		sync: mdiSync,
	} as const satisfies Record<string, IconType>

	// lucide-svelte types its icons as Svelte 4 classes, which prime-ui's `Icon` does not accept.
	const LUCIDE_ICONS = {
		'mouse-pointer': MousePointer2,
		ruler: Ruler,
	} as const

	type LucideIconName = keyof typeof LUCIDE_ICONS

	type DashboardIconName = keyof typeof PRIME_ICONS | LucideIconName

	const isLucideIcon = (name: DashboardIconName): name is LucideIconName => name in LUCIDE_ICONS
</script>

<script lang="ts">
	import type { ClassValue, HTMLButtonAttributes, MouseEventHandler } from 'svelte/elements'

	import { Icon, Tooltip } from '@viamrobotics/prime-ui'

	import type { Keybinding } from '#lib/keybindings/index.js'

	import Kbd from '../Kbd.svelte'

	interface Props extends HTMLButtonAttributes {
		icon: DashboardIconName
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

<Tooltip disabled={disableTooltip}>
	<Tooltip.Trigger>
		<label
			class={[
				className,
				'relative block rounded-md border',
				active
					? 'border-gray-8 bg-gray-8 z-4 text-white'
					: 'border-gray-5 text-gray-8 not-has-disabled:hover:bg-light not-has-disabled:active:bg-medium bg-white',
				'has-disabled:text-disabled has-disabled:cursor-not-allowed',
			]}
		>
			<button
				class="p-1.5 disabled:cursor-not-allowed"
				aria-label={description}
				aria-pressed={active}
				{onclick}
				{...rest}
			>
				{#if isLucideIcon(icon)}
					{@const LucideIcon = LUCIDE_ICONS[icon]}
					<LucideIcon size="16" />
				{:else}
					<Icon
						icon={PRIME_ICONS[icon]}
						class={iconCx}
					/>
				{/if}
			</button>
		</label>
	</Tooltip.Trigger>

	<Tooltip.Content placement={tooltipLocation ?? 'bottom'}>
		{description}

		{#if keybinding}
			<span class="pl-1"><Kbd binding={keybinding} /></span>
		{/if}
	</Tooltip.Content>
</Tooltip>
