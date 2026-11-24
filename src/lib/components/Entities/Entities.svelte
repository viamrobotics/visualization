<script lang="ts">
	import { Not } from 'koota'

	import { traits, useQuery } from '#lib/ecs/index.js'
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	import Arrows from './Arrows/ArrowGroups.svelte'
	import AxesHelpers from './AxesHelpers.svelte'
	import Boxes from './Boxes.svelte'
	import Capsules from './Capsules.svelte'
	import Cylinders from './Cylinders.svelte'
	import GeometryModel from './GeometryModel.svelte'
	import GLTF from './GLTF.svelte'
	import { useModelColliderHiding } from './hooks/useModelColliderHiding.svelte'
	import Labels from './Labels.svelte'
	import Line from './Line.svelte'
	import Mesh from './Mesh.svelte'
	import Points from './Points.svelte'
	import ShapeBatches from './ShapeBatches.svelte'
	import Spheres from './Spheres.svelte'

	const modelEntities = useQuery(traits.Model)
	const meshEntities = useQuery(Not(traits.Points), traits.BufferGeometry)
	const points = useQuery(traits.Points)
	const lines = useQuery(traits.LinePositions)
	const gltfs = useQuery(traits.GLTF)

	const settings = useSettings()
	const environment = useEnvironment()

	const enableLabels = $derived(settings.current.enableLabels)

	useModelColliderHiding()
</script>

{#each modelEntities.current as entity (entity)}
	<GeometryModel {entity} />
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

<ShapeBatches>
	<Capsules />
	<Cylinders />
	<Spheres />
	<Boxes />

	{#each meshEntities.current as entity (entity)}
		<Mesh {entity} />
	{/each}
</ShapeBatches>

{#if enableLabels && !environment.current.isImmersive}
	<Labels />
{/if}
