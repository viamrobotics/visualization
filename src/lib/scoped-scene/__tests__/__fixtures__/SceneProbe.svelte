<script lang="ts">
	import type { World } from 'koota'
	import type { Camera } from 'three'

	import { useThrelte } from '@threlte/core/webgpu'

	import { useWorld } from '#lib/ecs/index.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	interface Props {
		onready: (probe: {
			world: World
			settings: ReturnType<typeof useSettings>
			camera: () => Camera
		}) => void
	}

	let { onready }: Props = $props()

	const world = useWorld()
	const settings = useSettings()
	const threlte = useThrelte()

	$effect(() => {
		onready({ world, settings, camera: () => threlte.camera.current })
	})
</script>
