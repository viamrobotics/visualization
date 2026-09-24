<script lang="ts">
	import type { ClassValue } from 'svelte/elements'

	import { useResizeObserver } from 'runed'

	import Tooltip from '$lib/components/overlay/Tooltip.svelte'

	interface Props {
		text: string
		tooltipText?: string
		class?: ClassValue
		containerClass?: ClassValue
	}

	let { text, tooltipText, class: textClass = '', containerClass = '' }: Props = $props()

	let showTooltip = $state(false)
	let element = $state<HTMLElement | null>(null)

	useResizeObserver(
		() => element,
		() => {
			if (!element) {
				return
			}
			showTooltip = text.length > 0 && element.offsetWidth < element.scrollWidth
		}
	)
</script>

<div class={['min-w-0', containerClass]}>
	<Tooltip
		placement="top-start"
		openDelay={250}
		disabled={!showTooltip}
		triggerClass="w-full min-w-0"
	>
		<span
			bind:this={element}
			class={['block w-full truncate', textClass]}
			aria-label={tooltipText ?? text}
		>
			{text}
		</span>

		{#snippet content()}{tooltipText ?? text}{/snippet}
	</Tooltip>
</div>
