<script lang="ts">
	import { type Entity } from 'koota'

	import type { EditableFrameGeometry } from '#lib/defaultFrameGeometry.js'

	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { FrameEditor } from '#lib/editing/FrameEditor.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'

	import GeometryFields from './GeometryFields.svelte'
	import SectionNotice from './SectionNotice.svelte'
	import { changedAxes, MIXED, sharedNumber, sharedValue, toInputNumber } from './sharedValue'

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

	/** One dimension across frames that share a geometry type, as the number its input shows. */
	const shownDimension = (key: 'x' | 'y' | 'z' | 'r' | 'l'): number =>
		toInputNumber(
			sharedNumber(
				geometries.current.map(
					(geometry) => (geometry as Partial<Record<typeof key, number>>)[key] ?? Number.NaN
				)
			)
		)

	// Mixed dimensions are handed over as NaN, which the fields show as a dash.
	const geometry = $derived.by((): EditableFrameGeometry | undefined => {
		if (geometryType === 'box') {
			return { type: 'box', x: shownDimension('x'), y: shownDimension('y'), z: shownDimension('z') }
		}
		if (geometryType === 'sphere') return { type: 'sphere', r: shownDimension('r') }
		if (geometryType === 'capsule') {
			return { type: 'capsule', r: shownDimension('r'), l: shownDimension('l') }
		}
		return undefined
	})

	const handleChange = (next: EditableFrameGeometry) => {
		if (next.type !== (geometry?.type ?? 'none')) {
			for (const entity of entities) frameEditor.setGeometryType(entity, next.type)
			return
		}
		if (!geometry) return

		const patch = changedAxes(dimensionsOf(geometry), dimensionsOf(next))
		if (Object.keys(patch).length === 0) return

		// Each frame keeps its own value for every dimension left alone.
		for (const entity of entities) frameEditor.setGeometry(entity, { type: next.type, ...patch })
	}

	const dimensionsOf = (shape: EditableFrameGeometry): Record<string, number> =>
		Object.fromEntries(Object.entries(shape).filter(([key]) => key !== 'type'))
</script>

{#if geometryType === MIXED}
	<SectionNotice
		label="geometry"
		message="The selected frames have different geometry types."
	/>
{:else}
	<GeometryFields
		includeNone
		{geometry}
		onchange={handleChange}
	/>
{/if}
