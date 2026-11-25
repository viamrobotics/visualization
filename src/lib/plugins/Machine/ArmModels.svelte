<script lang="ts">
	import ArmModel from '#lib/components/ArmModel.svelte'
	import { use3DModels } from '#lib/hooks/use3DModels.svelte.js'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'

	const partID = usePartID()
	const models = use3DModels()
</script>

{#each models.arms as name (name)}
	<ArmModel
		partID={partID.current}
		{name}
	/>
{/each}
