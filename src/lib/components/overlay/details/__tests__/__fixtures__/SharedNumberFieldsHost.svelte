<script lang="ts">
	import SharedNumberFields from '../../SharedNumberFields.svelte'
	import { type Shared } from '../../sharedValue'

	type Key = 'x' | 'y' | 'z'

	interface Props {
		initial: Record<Key, Shared<number>>
		onchange: (patch: Partial<Record<Key, number>>) => void
	}

	const { initial, onchange }: Props = $props()

	// The values a parent would hold, written back after each patch as a details panel does.
	let values = $state({ ...initial })
</script>

<SharedNumberFields
	aria-label="position"
	fields={[
		{ key: 'x', label: 'X' },
		{ key: 'y', label: 'Y' },
		{ key: 'z', label: 'Z' },
	]}
	{values}
	onchange={(patch) => {
		values = { ...values, ...patch }
		onchange(patch)
	}}
/>
