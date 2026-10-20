<!--
@component

The light rig realistic mode replaces the flat toon rig with: one shadow-casting
key light, off the viewing axis, and the environment map carrying the fill.

Three compiles shadow code only once a light actually casts, so mounting this
component is what puts the scene's shadow pass to work, and the recompile the
light itself forces covers the switch.
-->
<script lang="ts">
	import type { DirectionalLight, Vector3Tuple } from 'three'

	import { T, useThrelte } from '@threlte/core'

	const { invalidate, scene } = useThrelte()

	/**
	 * The light sits off the default camera axis — `Scene.svelte` mounts the camera at
	 * `[3, 3, 3]` — so realistic mode shows form shading and a cast shadow the moment
	 * it is switched on. A light on the viewing axis lights every visible surface
	 * head-on and hides the shadow it casts behind the caster.
	 */
	const DIRECTIONAL_POSITION: Vector3Tuple = [5, -4, 8]

	/**
	 * Half-width of the shadow frustum, centred on the origin and sized to hold a
	 * workcell. Wider blurs an arm's own shadow away, narrower clips it. A cell parked
	 * further out than this from the origin casts nothing, which is what a fitted
	 * frustum or cascades would fix.
	 */
	const SHADOW_EXTENT = 6
	const SHADOW_MAP_SIZE = 2048
	const SHADOW_CAMERA_NEAR = 0.1
	const SHADOW_CAMERA_FAR = 30

	/**
	 * Colliders draw at 0.7 opacity but cast at full strength, the depth pass carrying
	 * no alpha, so an undimmed shadow reads as a silhouette rather than as contact.
	 */
	const SHADOW_INTENSITY = 0.8

	/**
	 * Offsetting along the surface normal keeps shadow acne off the curved colliders.
	 * What the offset has to clear is one shadow texel's world footprint, which
	 * `SHADOW_EXTENT` and `SHADOW_MAP_SIZE` between them set, so it is derived from
	 * both rather than picked. A bias chosen independently runs centimetres wide of a
	 * texel and detaches the contact shadow of anything gripper-sized.
	 */
	const NORMAL_BIAS_TEXELS = 2
	const SHADOW_TEXEL_SIZE = (2 * SHADOW_EXTENT) / SHADOW_MAP_SIZE

	const DIRECTIONAL_INTENSITY = 1.5

	/**
	 * Carries the fill an `AmbientLight` used to. Ambient adds the same term to every
	 * surface whichever way it faces, which flattens the shaping the environment map
	 * is already there to provide, so the rig leans on the map alone and turns it up
	 * to cover what ambient was contributing.
	 */
	const ENVIRONMENT_INTENSITY = 1.5

	const configureShadow = ({ shadow }: DirectionalLight) => {
		shadow.mapSize.setScalar(SHADOW_MAP_SIZE)
		shadow.intensity = SHADOW_INTENSITY
		shadow.normalBias = NORMAL_BIAS_TEXELS * SHADOW_TEXEL_SIZE
		shadow.camera.near = SHADOW_CAMERA_NEAR
		shadow.camera.far = SHADOW_CAMERA_FAR
		shadow.camera.left = -SHADOW_EXTENT
		shadow.camera.right = SHADOW_EXTENT
		shadow.camera.top = SHADOW_EXTENT
		shadow.camera.bottom = -SHADOW_EXTENT
		shadow.camera.updateProjectionMatrix()
	}

	// The scene outlives this component, and its environment map is shared with the
	// CAD models, which keep their `MeshStandardMaterial` in every mode. Restoring
	// the previous intensity on unmount is what keeps toon mode looking unchanged.
	$effect(() => {
		const previous = scene.environmentIntensity
		scene.environmentIntensity = ENVIRONMENT_INTENSITY
		invalidate()

		return () => {
			scene.environmentIntensity = previous
			invalidate()
		}
	})
</script>

<T.DirectionalLight
	position={DIRECTIONAL_POSITION}
	intensity={DIRECTIONAL_INTENSITY}
	castShadow
	oncreate={configureShadow}
/>
