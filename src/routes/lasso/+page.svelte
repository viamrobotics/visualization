<script lang="ts">
	import { LassoTool, PCD } from '$lib'
	import { createRandomPcdBinary } from '$lib/test/createRandomPcdBinary'
</script>

{#await createRandomPcdBinary(10_000, 1) then data}
	<LassoTool
		enabled
		onSelection={() => {
			/* do something */
		}}
	>
		<PCD {data} />
	</LassoTool>
{/await}
