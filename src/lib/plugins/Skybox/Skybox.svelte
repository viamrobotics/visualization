<script lang="ts">
	import { T } from '@threlte/core'
	import { EquirectangularReflectionMapping, type Texture, TextureLoader } from 'three'
	import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js'

	interface Props {
		url: string
		/**
		 * World-space position `[x, y, z]`. Defaults to `[0, 0, height]` so the
		 * dome's ground sits flush with the world XY plane in this Z-up scene.
		 */
		position?: [x: number, y: number, z: number]
		/**
		 * Euler rotation `[x, y, z]` in radians. Default aligns the
		 * equirectangular image's vertical axis (+Y) with this scene's vertical
		 * axis (+Z). The Z component then acts as yaw around world +Z.
		 */
		rotation?: [x: number, y: number, z: number]
		/**
		 * Camera height above ground when the source photo was taken. Larger
		 * values magnify the lower portion of the image.
		 */
		height?: number
		/**
		 * Skybox dome radius. Must exceed the scene camera's reach.
		 */
		radius?: number
	}

	const {
		url,
		position,
		rotation = [Math.PI / 2, 0, 0],
		height = 15,
		radius = 100,
	}: Props = $props()

	let texture = $state.raw<Texture | undefined>()

	$effect.pre(() => {
		let cancelled = false
		let loaded: Texture | undefined

		new TextureLoader().load(url, (t) => {
			if (cancelled) {
				t.dispose()
				return
			}
			t.mapping = EquirectangularReflectionMapping
			loaded = t
			texture = t
		})

		return () => {
			cancelled = true
			loaded?.dispose()
			texture = undefined
		}
	})

	const resolvedPosition = $derived(position ?? ([0, 0, height] as [number, number, number]))
</script>

{#if texture}
	<T
		is={GroundedSkybox}
		args={[texture, height, radius]}
		position={resolvedPosition}
		{rotation}
		raycast={() => null}
		bvh={{ enabled: false }}
	/>
{/if}
