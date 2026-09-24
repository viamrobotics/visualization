<script lang="ts">
	import { Switch } from '@viamrobotics/prime-core'

	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()
</script>

<div class="flex w-full flex-col gap-2.5 text-xs">
	<label class="flex items-center justify-between gap-2">
		Render stats <Switch bind:on={settings.current.renderStats} />
	</label>
</div>
