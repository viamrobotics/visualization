<script lang="ts">
	import { VisionClient } from '@viamrobotics/sdk'
	import DetectionsPlane from './DetectionsPlane.svelte'
	import {
		createResourceClient,
		createResourceQuery,
		useResourceNames,
	} from '@viamrobotics/svelte-sdk'
	import { usePartID } from '$lib/hooks/usePartID.svelte'

	const partID = usePartID()
	const cameras = useResourceNames(() => partID.current, 'camera')
	const services = useResourceNames(() => partID.current, 'vision')
	const visionClients = $derived(
		services.current.map((service) =>
			createResourceClient(
				VisionClient,
				() => partID.current,
				() => service.name
			)
		)
	)

	const queries = $derived(() =>
		visionClients.map((client) =>
			createResourceQuery(client, 'captureAllFromCamera', [
				cameras.current[0].name,
				{
					returnImage: true,
					returnClassifications: false,
					returnDetections: true,
					returnObjectPointClouds: false,
				},
			])
		)
	)

	$inspect(queries)
</script>

<DetectionsPlane detections={[]} />
