<script lang="ts">
	import { Switch } from '@viamrobotics/prime-ui'

	import { MIXED, MIXED_TEXT, type Shared } from './sharedValue'

	interface Props {
		label: string
		/** A mixed value shows off, beside a dash. Turning it on sets every entity on. */
		value: Shared<boolean>
		disabled?: boolean
		onchange: (next: boolean) => void
	}

	const { label, value, disabled = false, onchange }: Props = $props()

	const isMixed = $derived(value === MIXED)
</script>

<div class="flex items-center justify-between">
	<strong class="font-semibold">{label}</strong>

	<span class="flex items-center gap-2">
		{#if isMixed}
			<span
				class="text-subtle-2"
				aria-hidden="true">{MIXED_TEXT}</span
			>
		{/if}

		<Switch
			aria-label={isMixed ? `${label}, mixed` : label}
			bind:checked={() => value === true, (next) => onchange(next)}
			{disabled}
		/>
	</span>
</div>
