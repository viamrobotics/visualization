<!--
@component

Mounts ScopedScene the way a host does: inside ViamProvider, in an explicitly sized box.
-->
<script lang="ts">
	import { ViamProvider } from '@viamrobotics/svelte-sdk'
	import { ScopedScene } from '@viamrobotics/visualization/scoped-scene'
</script>

<ViamProvider dialConfigs={{}}>
	<div style="width: 672px; height: 504px;">
		<ScopedScene />
	</div>
</ViamProvider>
