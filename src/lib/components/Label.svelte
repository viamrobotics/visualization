<script lang="ts">
	import { HTML } from '@threlte/extras'
	import { labels } from './Labels.svelte'

	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { untrack } from 'svelte'

	interface Props {
		text?: string
	}

	let { text }: Props = $props()

	const settings = useSettings()

	const enabled = $derived(settings.current.enableLabels)

	let element = $state.raw<HTMLElement>()

	$effect(() => {
		const el = element

		if (!el) return

		return untrack(() => {
			labels.add(el)
			return () => labels.remove(el)
		})
	})
</script>

{#if enabled && text}
	<HTML
		center
		zIndexRange={[3, 0]}
	>
		<div
			class="label relative h-0 w-0"
			bind:this={element}
		>
			<svg class="link pointer-events-none absolute top-0 left-0 overflow-visible">
				<line
					stroke="black"
					stroke-width="1"
				/>
			</svg>
			<div class="dot absolute top-0 left-0 z-1 h-2 w-2 -translate-1/2 rounded-full bg-black"></div>
			<div class="border-gray-7 text absolute z-2 border bg-white px-2 py-1 text-xs text-nowrap">
				{text}
			</div>
		</div>
	</HTML>
{/if}
