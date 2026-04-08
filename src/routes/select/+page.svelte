<script lang="ts">
	import { PCD, SelectionTool } from '$lib'
	import { createRandomPcdBinary } from '$lib/test/createRandomPcdBinary'
</script>

<SelectionTool enabled />

{#await createRandomPcdBinary(10_000, 1) then data}
	<PCD {data} />
{/await}
