<script lang="ts">
	import { PCD, SelectionTool } from '$lib'
	import { createRandomPcdBinary } from '$lib/test/createRandomPcdBinary'

	import SelectionOverlay from '../lib/components/selectDemoPage/SelectionOverlay.svelte'
</script>

<SelectionTool enabled>
	<SelectionOverlay />
</SelectionTool>

{#await createRandomPcdBinary(10_000, 1) then data}
	<PCD {data} />
{/await}
