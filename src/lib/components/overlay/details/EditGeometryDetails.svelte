<script lang="ts">
	import { type Entity } from 'koota'

	import type { EditableFrameGeometry } from '$lib/defaultFrameGeometry'

	import { traits, useTrait } from '$lib/ecs'
	import { FrameEditor } from '$lib/editing/FrameEditor'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	import GeometryFields from './GeometryFields.svelte'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const partConfig = usePartConfig()

	const frameEditor = new FrameEditor(partConfig.updateFrame, partConfig.deleteFrame)

	const box = useTrait(() => entity, traits.Box)
	const sphere = useTrait(() => entity, traits.Sphere)
	const capsule = useTrait(() => entity, traits.Capsule)

	const geometry = $derived.by((): EditableFrameGeometry | undefined => {
		if (box.current) return { type: 'box', x: box.current.x, y: box.current.y, z: box.current.z }
		if (sphere.current) return { type: 'sphere', r: sphere.current.r }
		if (capsule.current) {
			return { type: 'capsule', r: capsule.current.r, l: capsule.current.l }
		}
		return undefined
	})

	const handleChange = (next: EditableFrameGeometry) => {
		if (next.type !== (geometry?.type ?? 'none')) {
			frameEditor.setGeometryType(entity, next.type)
			return
		}
		frameEditor.setGeometry(entity, next)
	}
</script>

<GeometryFields
	includeNone
	{geometry}
	onchange={handleChange}
/>
