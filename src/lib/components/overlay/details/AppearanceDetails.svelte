<script lang="ts">
	import type { Entity } from 'koota'

	import AxesHelperDetails from '#lib/components/overlay/details/AxesHelperDetails.svelte'
	import ColorDetails from '#lib/components/overlay/details/ColorDetails.svelte'
	import OpacityDetails from '#lib/components/overlay/details/OpacityDetails.svelte'

	interface Props {
		/** The selection. Never empty. */
		entities: readonly Entity[]
	}

	const { entities }: Props = $props()
</script>

<div class="flex flex-col gap-2.5 pt-3">
	<ColorDetails {entities} />
	<OpacityDetails {entities} />
	<AxesHelperDetails {entities} />
</div>
