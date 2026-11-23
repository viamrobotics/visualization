<script lang="ts">
	import { traits } from '#lib/ecs/index.js'
	import { provideSelectionOrder } from '#lib/hooks/useSelectionOrder.svelte.js'

	const order = provideSelectionOrder()
</script>

<p data-testid="selection-order">
	{order.current.map((entity) => entity.get(traits.Name)).join(',')}
</p>
