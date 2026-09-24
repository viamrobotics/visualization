<script lang="ts">
	import { subtypeToColor } from '$lib/color'

	interface Props {
		subtype: string
	}

	const { subtype }: Props = $props()

	const color = $derived(subtypeToColor(subtype)?.getStyle())
	const label = $derived(subtype.replaceAll('_', ' '))
</script>

<span
	class={[
		'inline-flex shrink-0 items-center rounded-sm px-1 py-0.5 text-[10px] font-medium tracking-wide uppercase',
		!color && 'bg-light text-subtle-1',
	]}
	style={color
		? `color: ${color}; background-color: color-mix(in srgb, ${color} 12%, transparent)`
		: undefined}
>
	{label}
</span>
