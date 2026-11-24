<script lang="ts">
	import { Switch } from '@viamrobotics/prime-ui'

	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	const settings = useSettings()
</script>

<div class="flex w-full flex-col gap-2.5 text-xs">
	<label class="flex items-center justify-between gap-2">
		Render stats <Switch bind:checked={settings.current.renderStats} />
	</label>
</div>
