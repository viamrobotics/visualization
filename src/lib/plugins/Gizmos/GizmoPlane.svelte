<!--
@component

A reference plane gizmo: a double-sided quad sized from `ReferencePlane`'s mm
dimensions and positioned by the entity's world matrix. The quad's raycast is
disabled so it never steals a hit from the surface underneath it that the
user is actually trying to click.
-->
<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'
	import type { Mesh } from 'three'

	import { T, type Props as ThrelteProps, useThrelte } from '@threlte/core'
	import { Color, DoubleSide, Group } from 'three'

	import { asColor } from '$lib/buffer'
	import { traits, useTrait } from '$lib/ecs'

	import { REFERENCE_GEOMETRY_COLOR, REFERENCE_GEOMETRY_OPACITY } from './spawn'
	import { ReferencePlane } from './traits'

	const MM_TO_M = 0.001

	interface Props extends ThrelteProps<typeof Mesh> {
		entity: Entity
		children?: Snippet
	}

	let { entity, children, ref = $bindable(), ...rest }: Props = $props()

	const { invalidate } = useThrelte()

	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const plane = useTrait(() => entity, ReferencePlane)
	const name = useTrait(() => entity, traits.Name)
	const entityColor = useTrait(() => entity, traits.Color)
	const opacity = useTrait(() => entity, traits.Opacity)
	const invisible = useTrait(() => entity, traits.InheritedInvisible)

	const group = new Group()
	group.matrixAutoUpdate = false

	const colorUtil = new Color()
	const color = $derived.by(() => {
		const rgb = entityColor.current
		if (rgb) return colorUtil.setRGB(rgb.r, rgb.g, rgb.b)
		return asColor(REFERENCE_GEOMETRY_COLOR, colorUtil)
	})

	const width = $derived((plane.current?.width ?? 0) * MM_TO_M)
	const height = $derived((plane.current?.height ?? 0) * MM_TO_M)
	const currentOpacity = $derived(opacity.current ?? REFERENCE_GEOMETRY_OPACITY)

	$effect(() => {
		if (!worldMatrix.current) return

		group.matrix.copy(worldMatrix.current)
		group.matrix.decompose(group.position, group.quaternion, group.scale)
		group.updateMatrixWorld()
		invalidate()
	})
</script>

<T
	is={group}
	visible={invisible.current !== true}
>
	<T.Mesh
		bind:ref
		{...rest}
		name={entity}
		userData.name={name.current}
		raycast={() => null}
		bvh={{ enabled: false }}
	>
		<T.PlaneGeometry args={[width, height]} />
		<T.MeshBasicMaterial
			{color}
			side={DoubleSide}
			transparent={currentOpacity < 1}
			depthWrite={currentOpacity === 1}
			opacity={currentOpacity}
		/>
	</T.Mesh>

	{@render children?.()}
</T>
