<script lang="ts">
	import { use3DModels } from '$lib/hooks/use3DModels.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'

	import ArmModel from './ArmModel.svelte'

	const partID = usePartID()
	const models = use3DModels()
</script>

{#each models.arms as name (name)}
	<ArmModel
		partID={partID.current}
		{name}
	/>
{/each}
