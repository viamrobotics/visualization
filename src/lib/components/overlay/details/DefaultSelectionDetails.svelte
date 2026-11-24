<!--
@component

The details panel for the selection, shown unless the active mode shows its own.
-->
<script lang="ts">
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { useSelectionOrder } from '#lib/hooks/useSelectionOrder.svelte.js'

	import SelectionDetails from './SelectionDetails.svelte'

	const environment = useEnvironment()
	const selected = useSelectionOrder()
</script>

{#if !environment.modeOwnsDetails && selected.current.length > 0}
	<SelectionDetails entities={selected.current} />
{/if}
