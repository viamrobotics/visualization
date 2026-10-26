<script lang="ts">
	import { Input, Switch } from '@viamrobotics/prime-core'

	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()
</script>

<div class="text-gray-9 flex flex-col gap-1 text-xs">
	<label class="flex items-center justify-between gap-2 py-1">
		Detect collisions <Switch bind:on={settings.current.enableCollisions} />
	</label>

	<label class="flex items-center justify-between gap-2">
		Touching tolerance (mm)

		<div class="w-20">
			<Input
				bind:value={settings.current.collisionToleranceMM}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>
</div>
