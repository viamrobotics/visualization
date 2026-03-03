<script lang="ts">
	import { Button, Icon } from '@viamrobotics/prime-core'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	const partConfig = usePartConfig()

	const { ...rest } = $props()

	const isMacDevice = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
	const iconName = isMacDevice ? ('apple-keyboard-command' as const) : ('chevron-up' as const)
	const iconLabel = isMacDevice ? 'command' : 'control'
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.metaKey) {
			if (event.key.toLowerCase() === 's') {
				event.preventDefault()
				event.stopImmediatePropagation()
				partConfig.save()
			}
		}
	}}
/>

{#if partConfig.isDirty}
	<div
		class="absolute bottom-8 z-4 flex w-full justify-center gap-2"
		{...rest}
	>
		<div
			class="flex items-center gap-8 rounded border-l-4 border-yellow-600 bg-yellow-50 px-4 py-2 shadow-2xl"
		>
			<div class="flex flex-col">
				<p class="text-sm">
					<strong>Live updates paused</strong>
				</p>

				<p class="text-subtle-2 text-sm">You are currently viewing a snapshot while editing.</p>
			</div>

			<div class="flex gap-2">
				<Button
					class="cursor-pointer text-blue-600"
					onclick={() => {
						partConfig.discardChanges()
					}}
				>
					Discard
				</Button>

				<Button
					variant="dark"
					aria-label="Save"
					class="cursor-pointer text-blue-600"
					onclick={() => {
						partConfig.save()
					}}
				>
					<div class="flex gap-2">
						Save
						<div class="font-roboto-mono text-disabled flex items-center">
							<Icon
								name={iconName}
								size="xs"
							/>
							<span class="sr-only">{iconLabel}</span>
							<span>S</span>
						</div>
					</div>
				</Button>
			</div>
		</div>
	</div>
{/if}
