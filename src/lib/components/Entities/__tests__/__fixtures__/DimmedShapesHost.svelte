<script
	lang="ts"
	module
>
	import type { Entity, World } from 'koota'
	import type { Color } from 'three'

	export interface RenderedAppearance {
		color: Color
		opacity: number
	}

	export interface DimmedShapesProbe {
		world: World
		/** The last color and opacity a renderer handed to `setAppearance` for the entity. */
		appearanceOf: (entity: Entity) => RenderedAppearance | undefined
	}
</script>

<script lang="ts">
	import { Canvas } from '@threlte/core/webgpu'
	import { MeshBasicMaterial } from 'three'

	import type { ShapeInstanceIds } from '#lib/three/shapeBatches.js'

	import { provideWorld, traits, useQuery, useWorld } from '#lib/ecs/index.js'
	import { provideSettings } from '#lib/hooks/useSettings.svelte.js'
	import { createShapeBatches } from '#lib/three/shapeBatches.js'

	import Boxes from '../../Boxes.svelte'
	import Capsules from '../../Capsules.svelte'
	import Cylinders from '../../Cylinders.svelte'
	import Mesh from '../../Mesh.svelte'
	import Spheres from '../../Spheres.svelte'
	import { provideShapeBatches } from '../../useShapeBatches'

	interface Props {
		onready: (probe: DimmedShapesProbe) => void
	}

	let { onready }: Props = $props()

	provideWorld()
	provideSettings({ persist: false })

	const world = useWorld()
	const shapes = provideShapeBatches(
		createShapeBatches((parameters) => new MeshBasicMaterial(parameters))
	)
	const meshes = useQuery(traits.BufferGeometry)

	const entityByHandle = new Map<ShapeInstanceIds, Entity>()
	const appearances = new Map<Entity, RenderedAppearance>()

	const { add, addMesh, setAppearance } = shapes
	shapes.add = (entity, shape) => {
		const ids = add(entity, shape)
		entityByHandle.set(ids, entity)
		return ids
	}
	shapes.addMesh = (entity, slot) => {
		const ids = addMesh(entity, slot)
		entityByHandle.set(ids, entity)
		return ids
	}
	shapes.setAppearance = (ids, color, opacity, visible) => {
		const entity = entityByHandle.get(ids)
		if (entity) appearances.set(entity, { color: color.clone(), opacity })
		setAppearance(ids, color, opacity, visible)
	}

	$effect(() => {
		onready({ world, appearanceOf: (entity) => appearances.get(entity) })
	})
</script>

<Canvas>
	<Boxes />
	<Capsules />
	<Cylinders />
	<Spheres />

	{#each meshes.current as entity (entity)}
		<Mesh {entity} />
	{/each}
</Canvas>
