<script lang="ts">
	import type { Entity } from 'koota'

	import { MathUtils, Quaternion, Vector3 } from 'three'

	import type { HoverInfo } from '$lib/HoverUpdater.svelte'

	import { traits, useTrait } from '$lib/ecs'
	import { OrientationVector } from '$lib/math/OrientationVector'

	import HoveredEntityTooltip from './HoveredEntityTooltip.svelte'

	interface Props {
		entity: Entity
	}

	let { entity }: Props = $props()

	const instancedMatrix = useTrait(() => entity, traits.InstancedMatrix)

	// Pool: InstancedMatrix's `Matrix4` is in metres (matches Three.js).
	// Decompose for the tooltip's display, which expects metres for position
	// and OV+theta for orientation.
	const translation = new Vector3()
	const quaternion = new Quaternion()
	const scaleVec = new Vector3()
	const ov = new OrientationVector()

	const hoverInfo = $derived.by((): HoverInfo | undefined => {
		const data = instancedMatrix.current
		if (!data) return undefined
		data.matrix.decompose(translation, quaternion, scaleVec)
		ov.setFromQuaternion(quaternion)
		return {
			index: data.index,
			x: translation.x,
			y: translation.y,
			z: translation.z,
			oX: ov.x,
			oY: ov.y,
			oZ: ov.z,
			theta: MathUtils.radToDeg(ov.th),
		}
	})
</script>

{#if hoverInfo}
	<HoveredEntityTooltip {hoverInfo} />
{/if}
