<script
	module
	lang="ts"
>
	import type { World } from 'koota'
	import type { Camera, Scene } from 'three'

	/** What a spec needs to reach inside the scene: its world, the DOM the controls listen on, and the transform controls' state. */
	export interface MoveTargetGizmoProbeHandle {
		world: World
		scene: Scene
		dom: HTMLElement
		camera: () => Camera
		isTransformControlsActive: () => boolean
	}
</script>

<script lang="ts">
	import { useThrelte } from '@threlte/core/webgpu'

	import { useWorld } from '#lib/ecs/index.js'
	import { useTransformControls } from '#lib/hooks/useControls.svelte.js'

	interface Props {
		onready: (probe: MoveTargetGizmoProbeHandle) => void
	}

	let { onready }: Props = $props()

	const world = useWorld()
	const threlte = useThrelte()
	const transformControls = useTransformControls()

	$effect(() => {
		onready({
			world,
			scene: threlte.scene,
			dom: threlte.dom,
			camera: () => threlte.camera.current,
			isTransformControlsActive: () => transformControls.active,
		})
	})
</script>
