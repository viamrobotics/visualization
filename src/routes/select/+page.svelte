<script lang="ts">
	import { PCD, SelectionTool } from '$lib'
	import { createRandomPcdBinary } from '$lib/test/createRandomPcdBinary'
</script>

<SelectionTool
	enabled
	onSelection={() => {
		/* do something */
	}}
/>

{#await createRandomPcdBinary(10_000, 1) then data}
	<PCD {data} />
{/await}
