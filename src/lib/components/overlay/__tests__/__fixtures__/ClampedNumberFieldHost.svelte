<script lang="ts">
	import HeldNumberField from '../../HeldNumberField.svelte'

	interface Props {
		onwrite: (value: number) => void
	}

	const { onwrite }: Props = $props()

	const MIN = 2

	// A setting that clamps every write, as the IK path steps do.
	let value = $state(25)
</script>

<HeldNumberField
	label="steps"
	bind:value={
		() => value,
		(next) => {
			if (next === undefined) return
			value = Math.max(next, MIN)
			onwrite(value)
		}
	}
/>
<button type="button">elsewhere</button>
