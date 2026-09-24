<script lang="ts">
	import { Not } from 'koota'

	import { traits, useQuery } from '$lib/ecs'
	import { matchModel, use3DModels } from '$lib/hooks/use3DModels.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import Arrows from './Arrows/ArrowGroups.svelte'
	import AxesHelpers from './AxesHelpers.svelte'
	import Boxes from './Boxes.svelte'
	import Capsules from './Capsules.svelte'
	import Cylinders from './Cylinders.svelte'
	import GeometryModel from './GeometryModel.svelte'
	import GLTF from './GLTF.svelte'
	import Labels from './Labels.svelte'
	import Line from './Line.svelte'
	import Mesh from './Mesh.svelte'
	import Points from './Points.svelte'
	import Spheres from './Spheres.svelte'

	const frameEntities = useQuery(traits.FramesAPI)
	const meshEntities = useQuery(Not(traits.Points), traits.BufferGeometry)
	const points = useQuery(traits.Points)
	const lines = useQuery(traits.LinePositions)
	const gltfs = useQuery(traits.GLTF)

	const settings = useSettings()
	const models = use3DModels()

	const enableLabels = $derived(settings.current.enableLabels)

	/**
	 * A CAD model stands in for a collider named `<component>:<id>`, which reaches
	 * the scene as a kinematics link frame. Narrowed to frames a model actually
	 * covers: every other frame would mount a component that renders nothing, and
	 * this list is every frame in the scene. Reading `Name` untracked is safe
	 * because a renamed frame is respawned — `useFrames` keys its entities by name.
	 */
	const modelFrameEntities = $derived(
		frameEntities.current.filter(
			(entity) => matchModel(entity.get(traits.Name), models.current) !== undefined
		)
	)
</script>

{#each modelFrameEntities as entity (entity)}
	<GeometryModel {entity} />
{/each}

{#each meshEntities.current as entity (entity)}
	<Mesh {entity} />
{/each}

{#each points.current as entity (entity)}
	<Points {entity} />
{/each}

{#each lines.current as entity (entity)}
	<Line {entity} />
{/each}

{#each gltfs.current as entity (entity)}
	<GLTF {entity} />
{/each}

<Arrows />
<AxesHelpers />

<Capsules />
<Cylinders />
<Spheres />
<Boxes />

{#if enableLabels}
	<Labels />
{/if}
