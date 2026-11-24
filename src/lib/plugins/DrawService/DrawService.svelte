<script lang="ts">
	import { traits, useFolder } from '#lib/ecs/index.js'

	import {
		type DrawConnectionConfig,
		provideDrawConnectionConfig,
	} from './useDrawConnectionConfig.svelte'
	import { provideDrawService } from './useDrawService.svelte'

	interface Props {
		config: DrawConnectionConfig
	}

	let { config }: Props = $props()

	provideDrawConnectionConfig(() => config)
	provideDrawService()

	// Shared by id with the snapshots `FileDrop` imports.
	useFolder({ id: 'drawn', name: 'Drawn', order: 700, sources: [traits.DrawAPI] })
</script>
