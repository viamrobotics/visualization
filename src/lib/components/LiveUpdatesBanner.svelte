<script lang="ts">
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	const partConfig = usePartConfig()

	const { ...rest } = $props()
</script>

{#if partConfig.isDirty}
	<div
		class="absolute bottom-8 z-1000 flex w-full justify-center gap-2"
		{...rest}
	>
		<div
			class="flex flex-col items-start rounded border-l-4 border-yellow-600 bg-yellow-50 px-4 py-2"
		>
			<p>
				<strong>Live Updates Paused</strong>
			</p>

			<p class="text-sm">
				<button
					class="cursor-pointer text-blue-600"
					onclick={() => {
						partConfig.saveLocalPartConfig()
					}}>Save</button
				>
				or
				<button
					class="cursor-pointer text-blue-600"
					onclick={() => {
						partConfig.resetLocalPartConfig()
					}}>Discard</button
				>
				to resume.
			</p>
		</div>
	</div>
{/if}
