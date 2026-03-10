<script lang="ts">
	import { LassoTool, PCD } from '$lib'
	import { createRandomPcdBinary } from '$lib/test/createRandomPcdBinary'
</script>

<LassoTool
	enabled
	onSelection={() => {
		/* do something */
	}}
/>

{#await createRandomPcdBinary(10_000, 1) then data}
	<PCD {data} />
{/await}
