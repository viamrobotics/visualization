<script lang="ts">
	import { type Entity } from 'koota'

	import type { EditableFrameGeometry } from '#lib/defaultFrameGeometry.js'

	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { FrameEditor } from '#lib/editing/FrameEditor.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'

	import GeometryFields from './GeometryFields.svelte'
	import SectionNotice from './SectionNotice.svelte'
	import { type GeometryDimension, sharedGeometryDimensions } from './sharedGeometryDimensions'
	import { MIXED, sharedValue } from './sharedValue'

	interface Props {
		/** The selected frames. Never empty. */
		entities: readonly Entity[]
	}

	const { entities }: Props = $props()

	const partConfig = usePartConfig()

	const frameEditor = new FrameEditor(partConfig.updateFrame, partConfig.deleteFrame)

	const geometries = useMappedEntitiesTraits(
		() => entities,
		[traits.Box, traits.Sphere, traits.Capsule],
		(entity): EditableFrameGeometry => {
			const box = entity.get(traits.Box)
			if (box) return { type: 'box', x: box.x, y: box.y, z: box.z }

			const sphere = entity.get(traits.Sphere)
			if (sphere) return { type: 'sphere', r: sphere.r }

			const capsule = entity.get(traits.Capsule)
			if (capsule) return { type: 'capsule', r: capsule.r, l: capsule.l }

			return { type: 'none' }
		}
	)

	const geometryType = $derived(sharedValue(geometries.current.map((geometry) => geometry.type)))

	const dimensions = $derived(
		sharedGeometryDimensions(
			geometries.current as readonly Partial<Record<GeometryDimension, number>>[]
		)
	)
</script>

{#if geometryType === MIXED}
	<SectionNotice
		label="geometry"
		message="The selected frames have different geometry types."
	/>
{:else}
	<GeometryFields
		includeNone
		type={geometryType}
		{dimensions}
		ontypechange={(type) => {
			for (const entity of entities) frameEditor.setGeometryType(entity, type)
		}}
		ondimensionchange={(patch) => {
			// Each frame keeps its own value for every dimension left alone.
			for (const entity of entities) frameEditor.setGeometry(entity, { type: geometryType, ...patch })
		}}
	/>
{/if}
