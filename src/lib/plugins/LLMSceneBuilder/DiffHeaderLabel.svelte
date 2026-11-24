<script lang="ts">
	import type { ClassValue } from 'svelte/elements'

	import { Tooltip } from '@viamrobotics/prime-ui'
	import { useResizeObserver } from 'runed'

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
		openDelay={250}
		disabled={!showTooltip}
	>
		<Tooltip.Trigger class="flex w-full min-w-0">
			<span
				bind:this={element}
				class={['block w-full truncate', textClass]}
				aria-label={tooltipText ?? text}
			>
				{text}
			</span>
		</Tooltip.Trigger>
		<Tooltip.Content side="top">{tooltipText ?? text}</Tooltip.Content>
	</Tooltip>
</div>
