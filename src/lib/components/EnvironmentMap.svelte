<!--
@component

The scene's sky and image-based lighting. Wraps `<Environment>` with the two
corrections a Z-up scene needs: the equirectangular map has to be turned onto its
side, and the ground projection has to be turned and lifted along with it.
-->
<script lang="ts">
	import { T, useThrelte } from '@threlte/core'
	import { Environment } from '@threlte/extras'
	import { Euler, type Texture } from 'three'
	import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js'

	import environmentHdr from '../assets/hanger_exterior_cloudy_2k.hdr'

	const { invalidate, scene } = useThrelte()

	/**
	 * Three samples an equirectangular map with +Y as the zenith. This scene is Z-up,
	 * since `Camera.svelte` mounts every camera with `up={[0, 0, 1]}`, so a quarter
	 * turn about X is what carries the map's +Y onto the world's +Z. Without it the
	 * map's ground renders up a wall.
	 */
	const ZENITH_TURN = Math.PI / 2
	const ZENITH_ROTATION = new Euler(ZENITH_TURN, 0, 0)

	/**
	 * How far above the ground the camera that shot the map stood. `GroundedSkybox`
	 * scales the projected ground by it, landing a point that really sat at distance D
	 * at `D * CAPTURE_HEIGHT / actual`, so a map whose ground carries a known-size
	 * feature shows the error and one with an even texture hides it. A tripod's worth
	 * is the usual answer and no HDRI library publishes the real figure.
	 */
	const CAPTURE_HEIGHT = 1.6

	/**
	 * Distance to the nearest thing standing on the ground, in capture heights. The
	 * projection lays a vertical surface's lowest `CAPTURE_HEIGHT` metres flat, running
	 * outward from its own base, so ground drawn past that surface is smeared surface.
	 * The projected plane stops at `SKYBOX_RADIUS`, which is why this sets it.
	 */
	const NEAREST_STRUCTURE_RATIO = 7.5

	/**
	 * Radius of the projected sky. Pulling it in shortens the smear and costs parallax
	 * on whatever the map holds above the horizon, so an even sky pays less for it than
	 * a detailed one. Orbiting past it falls back to the unprojected background, and
	 * the orthographic camera in `Camera.svelte` spans 100 units of depth, which is the
	 * hard ceiling.
	 */
	const SKYBOX_RADIUS = CAPTURE_HEIGHT * NEAREST_STRUCTURE_RATIO

	let texture = $state.raw<Texture | undefined>()

	// The scene outlives this component, and both rotations are scene-wide state
	// rather than anything `<Environment>` owns.
	$effect(() => {
		const previousBackground = scene.backgroundRotation.clone()
		const previousEnvironment = scene.environmentRotation.clone()
		scene.backgroundRotation.copy(ZENITH_ROTATION)
		scene.environmentRotation.copy(ZENITH_ROTATION)
		invalidate()

		return () => {
			scene.backgroundRotation.copy(previousBackground)
			scene.environmentRotation.copy(previousEnvironment)
			invalidate()
		}
	})

	// `<Environment>`'s own `ground` prop builds the skybox at a radius of 1, hands it
	// no rotation, and leaves it in the raycaster's path. Building it here is what
	// gets a scene-sized sphere, the Z-up turn, and an opt-out from hit-testing.
	const skybox = $derived(
		texture === undefined ? undefined : new GroundedSkybox(texture, CAPTURE_HEIGHT, SKYBOX_RADIUS)
	)

	// `dispose={false}` below, because Threlte's disposal would take the texture with
	// it and `scene.environment` still reads from that.
	$effect(() => {
		const mesh = skybox
		if (mesh === undefined) return

		return () => {
			mesh.geometry.dispose()
			mesh.material.dispose()
		}
	})
</script>

<Environment
	isBackground
	url={environmentHdr}
	bind:texture
/>

{#if skybox}
	<T
		is={skybox}
		dispose={false}
		raycast={() => null}
		bvh={{ enabled: false }}
		rotation.x={ZENITH_TURN}
		position.z={CAPTURE_HEIGHT}
	/>
{/if}
