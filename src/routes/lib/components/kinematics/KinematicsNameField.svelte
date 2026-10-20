<script lang="ts">
	import { Input } from '@viamrobotics/prime-core'

	interface Props {
		value: string
		/** True when another item already uses the name, so renaming to it is refused. */
		taken: (name: string) => boolean
		onrename: (name: string) => void
	}

	let { value, taken, onrename }: Props = $props()

	const rename = (event: Event) => {
		const input = event.target as HTMLInputElement
		const next = input.value.trim()
		if (next === '' || next === value || taken(next)) {
			// prime's Input keeps what was typed, so put the current name back.
			input.value = value
			return
		}
		onrename(next)
	}
</script>

<label class="text-default flex flex-col gap-1 text-xs">
	Name
	<Input
		{value}
		on:change={rename}
	/>
</label>
