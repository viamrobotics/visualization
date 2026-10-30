<script lang="ts">
	/**
	 * Stands up the config providers the way `App` does, under whatever ancestors
	 * the spec mounts, which for a connection-only embed is none.
	 */

	import { provideWorld } from '$lib/ecs'
	import { provideFragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'
	import { providePartConfig, usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	provideWorld()
	provideFragmentInfo(
		() => 'part-id',
		() => undefined,
		() => undefined
	)
	providePartConfig(
		() => 'part-id',
		() => undefined
	)

	const partConfig = usePartConfig()
</script>

<dl>
	<dt>ready</dt>
	<dd data-testid="ready">{partConfig.isReady}</dd>
	<dt>editable</dt>
	<dd data-testid="editable">{partConfig.hasEditPermissions}</dd>
	<dt>config source</dt>
	<dd data-testid="config-source">{partConfig.hasConfigSource}</dd>
</dl>
