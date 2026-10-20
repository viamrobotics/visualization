<script lang="ts">
	import { Button } from '@viamrobotics/prime-core'

	interface Props {
		/** The button's accessible name. It begins with `text`, such as `Replace file for base`. */
		label: string
		/** Visible button text. */
		text: string
		onpick: (bytes: Uint8Array) => void
	}

	let { label, text, onpick }: Props = $props()

	let input: HTMLInputElement | undefined = $state()

	const onchange = async (event: Event) => {
		const target = event.currentTarget as HTMLInputElement
		const file = target.files?.[0]
		// Clear it so picking the same file again still fires `change`.
		target.value = ''
		if (file) onpick(new Uint8Array(await file.arrayBuffer()))
	}
</script>

<input
	bind:this={input}
	type="file"
	accept=".stl,.ply,.obj,.dae"
	class="sr-only"
	aria-hidden="true"
	data-testid="kinematics-source-input"
	tabindex="-1"
	{onchange}
/>
<Button
	variant="ghost-outline"
	textSize="text-xs"
	aria-label={label}
	onclick={() => input?.click()}
>
	{text}
</Button>
