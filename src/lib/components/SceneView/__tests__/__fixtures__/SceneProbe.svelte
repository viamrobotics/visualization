<script lang="ts">
	import type { World } from 'koota'
	import type { Camera } from 'three'

	import { useThrelte } from '@threlte/core/webgpu'

	import type { EventBus } from '#lib/hooks/useEventBus.js'

	import { useWorld } from '#lib/ecs/index.js'
	import { useEventBus } from '#lib/hooks/useEventBus.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	interface Props {
		onready: (probe: {
			world: World
			settings: ReturnType<typeof useSettings>
			camera: () => Camera
			bus: EventBus
			/** False when no scene provided a bus, since each lookup then makes its own. */
			isSceneBus: boolean
		}) => void
	}

	let { onready }: Props = $props()

	const world = useWorld()
	const settings = useSettings()
	const threlte = useThrelte()
	const bus = useEventBus()
	const isSceneBus = useEventBus() === bus

	$effect(() => {
		onready({ world, settings, camera: () => threlte.camera.current, bus, isSceneBus })
	})
</script>
