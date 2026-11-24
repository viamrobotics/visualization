<script lang="ts">
	import { Input } from '@viamrobotics/prime-ui'

	import { MIXED, MIXED_TEXT, type Shared } from './sharedValue'

	interface Props {
		label: string
		/** A `#rrggbb` color. */
		value: Shared<string>
		/** Where the picker opens when the value is mixed. */
		mixedSeed: string
		/** Called with the picked `#rrggbb` color, for every entity. */
		onchange: (next: string) => void
	}

	const { label, value, mixedSeed, onchange }: Props = $props()

	const id = $props.id()
</script>

<div>
	<label
		for={id}
		class="font-semibold"
	>
		{label}
	</label>
	<div class="mt-0.5 flex items-center gap-2">
		<Input
			{id}
			type="color"
			class="h-6 w-12 p-0.5"
			aria-label={value === MIXED ? `${label}, mixed` : undefined}
			bind:value={
				() => (value === MIXED ? mixedSeed : value),
				(next) => {
					if (next) onchange(next)
				}
			}
		/>
		{#if value === MIXED}
			<span
				class="text-subtle-1"
				aria-hidden="true">{MIXED_TEXT}</span
			>
		{:else}
			<span class="text-subtle-2 font-roboto-mono">{value}</span>
		{/if}
	</div>
</div>
