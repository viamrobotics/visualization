<script
	lang="ts"
	module
>
	/** The `DomPortal` id `<XRMachine>` fills with its settings, below the enable switch. */
	export const XR_MACHINE_SETTINGS_PORTAL_ID = 'xr-machine-settings'
</script>

<script lang="ts">
	import { Switch } from '@viamrobotics/prime-ui'

	import DomPortalTarget from '#lib/components/overlay/Portals/DomPortalTarget.svelte'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	const settings = useSettings()
</script>

<div class="flex flex-col gap-2.5 text-xs">
	<label class="flex items-center justify-between gap-2">
		Enable VR / AR mode <Switch bind:checked={settings.current.enableXR} />
	</label>

	<DomPortalTarget id={XR_MACHINE_SETTINGS_PORTAL_ID} />
</div>
