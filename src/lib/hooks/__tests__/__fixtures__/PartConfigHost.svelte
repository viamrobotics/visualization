<script lang="ts">
	import { provideWorld } from '#lib/ecs/index.js'
	import { provideFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import { providePartConfig, usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'

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
