<script lang="ts">
	import type { Entity } from 'koota'

	import { T, useThrelte } from '@threlte/core'
	import { type Snippet } from 'svelte'
	import { Color, DoubleSide, FrontSide, Group, Mesh } from 'three'

	import { asColor } from '$lib/buffer'
	import { colors, darkenColor } from '$lib/color'
	import { traits, useOpacity, useTag, useTrait } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { Pose } from '$lib/math'
	import { createSurfaceMaterial } from '$lib/three/surfaceShading'

	import { useEntityEvents } from './hooks/useEntityEvents.svelte'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	const { entity, children }: Props = $props()

	const { invalidate } = useThrelte()
	const settings = useSettings()

	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const center = useTrait(() => entity, traits.Center)
	const invisible = useTrait(() => entity, traits.InheritedInvisible)
	const colliderHidden = useTag(() => entity, traits.ColliderHidden)
	const name = useTrait(() => entity, traits.Name)
	const entityColors = useTrait(() => entity, traits.Colors)
	const entityColor = useTrait(() => entity, traits.Color)
	const opacity = useOpacity(() => entity)
	const bufferGeometry = useTrait(() => entity, traits.BufferGeometry)
	const materialProps = useTrait(() => entity, traits.Material)
	const renderOrder = useTrait(() => entity, traits.RenderOrder)

	const color = $derived.by(() => {
		if (entityColors.current) {
			return asColor(entityColors.current, new Color())
		}

		if (entityColor.current) {
			return new Color().setRGB(entityColor.current.r, entityColor.current.g, entityColor.current.b)
		}

		return colors.default
	})

	const hasVertexColors = $derived(bufferGeometry.current?.getAttribute('color') !== undefined)

	const currentOpacity = $derived(opacity.current)
	const isTransparent = $derived(currentOpacity < 1)

	const events = useEntityEvents(() => entity)

	const group = new Group()
	group.matrixAutoUpdate = false

	$effect(() => {
		if (!worldMatrix.current) return

		group.matrix.copy(worldMatrix.current)

		/**
		 * Keep position/quaternion/scale in sync with matrix so TransformControls
		 * (which reads/writes those fields) sees the entity's actual transform on
		 * drag start. Without this, the gizmo applies its drag delta against an
		 * identity baseline and the frame snaps to identity on first onChange.
		 */
		group.matrix.decompose(group.position, group.quaternion, group.scale)

		group.updateMatrixWorld()
		invalidate()
	})

	// Threlte swaps the attached material when `is` changes and disposes every one
	// it held once this component unmounts, so a mode change needs no cleanup here.
	const material = $derived(createSurfaceMaterial(settings.current.renderMode, {}))

	$effect(() => {
		material.depthWrite = !isTransparent
		material.opacity = currentOpacity
		if (material.transparent !== isTransparent) {
			material.transparent = isTransparent
			material.needsUpdate = true
		}
		invalidate()
	})

	const mesh = new Mesh()
	const tempPose = new Pose()

	$effect(() => {
		if (center.current) {
			tempPose.copy(center.current).toObject3D(mesh)
			invalidate()
		}
	})
</script>

<T
	is={group}
	visible={invisible.current !== true && !colliderHidden.current}
>
	<T
		is={mesh}
		name={entity}
		userData.name={name}
		renderOrder={renderOrder.current}
		castShadow
		receiveShadow
		{...events}
	>
		{#if bufferGeometry.current}
			<!--
			Keyed on the geometry: Threlte disposes a <T>'s object on unmount only, never
			when `is`/`args` swap it. Unkeyed, each swap orphans an undisposed EdgesGeometry.
		-->
			{#key bufferGeometry.current}
				<T is={bufferGeometry.current}>
					{#snippet children({ ref: geo })}
						<!--
						TODO(mp) currently some bufferGeometries are coming in empty,
						this is a quick fix but this should be handled upstream
					-->
						{#if (geo.getAttribute('position')?.array.length ?? 0) > 0}
							<T.LineSegments
								raycast={() => null}
								bvh={{ enabled: false }}
							>
								<T.EdgesGeometry args={[geo, 0]} />
								<T.LineBasicMaterial
									color={darkenColor(color, 10)}
									transparent
									opacity={currentOpacity}
									depthWrite={!isTransparent}
								/>
							</T.LineSegments>
						{/if}
					{/snippet}
				</T>
			{/key}
		{/if}

		<T
			is={material}
			color={hasVertexColors ? 0xffffff : color}
			vertexColors={hasVertexColors}
			side={bufferGeometry.current ? DoubleSide : FrontSide}
			depthTest={materialProps.current?.depthTest ?? true}
		/>

		{@render children?.()}
	</T>
</T>
