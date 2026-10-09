<script lang="ts">
	import { PCD } from '#lib'
	import { SelectionTool, TopDownLock } from '#lib/plugins/index.js'
	import { createRandomPcdBinary } from '#lib/test/createRandomPcdBinary.js'

	import SelectionOverlay from '../lib/components/selectDemoPage/SelectionOverlay.svelte'
</script>

<SelectionTool enabled>
	<SelectionOverlay />
</SelectionTool>
<TopDownLock />

{#await createRandomPcdBinary(10_000, 1) then data}
	<PCD
		name="Points 1"
		{data}
		interactionLayers={['selectTool']}
	/>
{/await}

{#await createRandomPcdBinary(1_000, 1) then data}
	<PCD
		name="Points 2"
		{data}
		interactionLayers={['selectTool']}
	/>
{/await}
