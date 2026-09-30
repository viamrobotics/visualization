<script lang="ts">
	import type { Entity } from 'koota'

	import { CameraClient } from '@viamrobotics/sdk'
	import { createResourceClient, createResourceQuery } from '@viamrobotics/svelte-sdk'
	import { Matrix4 } from 'three'

	import { createBufferGeometry, updateBufferGeometry } from '$lib/attribute'
	import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
	import { RefetchRates } from '$lib/components/overlay/refetchRates'
	import { hierarchy, setOrAddTrait, traits, useWorld } from '$lib/ecs'
	import { FRAME_ENTITY_QUERY } from '$lib/hooks/useFrameEntities.svelte'
	import { usePointClouds } from '$lib/hooks/usePointclouds.svelte'
	import { RefreshRates, useSettings } from '$lib/hooks/useSettings.svelte'
	import { parsePcdInWorker } from '$lib/loaders/pcd'
	import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'
	import { attachPointsBvh } from '$lib/three/pointsBvh'

	interface Props {
		partID: string
		name: string
	}

	let { partID, name }: Props = $props()

	const world = useWorld()
	const logs = useLogs()
	const settings = useSettings()
	const { refetchers } = usePointClouds()
	const { refreshRates, disabledCameras } = $derived(settings.current)

	const client = createResourceClient(
		CameraClient,
		() => partID,
		() => name
	)

	const properties = createResourceQuery(client, 'getProperties', {
		staleTime: Infinity,
		refetchOnMount: false,
		refetchInterval: false,
	})

	const interval = $derived(refreshRates[RefreshRates.pointclouds])

	const enabled = $derived(
		properties.isPending === false &&
			interval !== RefetchRates.OFF &&
			disabledCameras[name] !== true
	)

	const query = createResourceQuery(client, 'getPointCloud', () => ({
		enabled,
		// The chosen refresh rate should be the only thing that fetches.
		refetchOnWindowFocus: false,
		refetchInterval: interval === RefetchRates.MANUAL ? (false as const) : interval,
	}))

	/**
	 * A camera that cannot serve pointclouds is disabled once, and a user can
	 * still turn it back on by hand.
	 */
	$effect(() => {
		if (properties.data?.supportsPcd === false && disabledCameras[name] === undefined) {
			disabledCameras[name] = true
		}
	})

	$effect(() => {
		const registration = `${partID}:${name}`
		refetchers.set(registration, () => query.refetch())
		return () => refetchers.delete(registration)
	})

	$effect(() => {
		if (query.isFetching) {
			logs.add(`Fetching pointcloud for ${name}...`, 'info', {
				resource: name,
				folder: 'pointclouds',
			})
		} else if (query.error) {
			logs.add(`Error fetching pointcloud from ${name}: ${query.error.message}`, 'error', {
				resource: name,
				folder: 'pointclouds',
			})
		}
	})

	/**
	 * Where the camera was when it captured the points this component is holding.
	 * Points come back in the camera's frame, so composing them through its live
	 * pose would drag an already-captured cloud along behind a moving arm and draw
	 * it somewhere the camera never saw.
	 *
	 * Read when the parsed points land, so it trails the true capture by the round
	 * trip plus the parse. Sampling as the request goes out would be closer, but
	 * that means hanging the only sample on a transient `isFetching` edge, and it
	 * never fired.
	 */
	const captureMatrix = new Matrix4()
	let hasCaptureMatrix = false

	const noFrameWarning = $derived(
		`${name} has no frame, drawing its pointcloud at the world origin`
	)
	const warningTarget = $derived({ resource: name, folder: 'pointclouds' })

	/**
	 * The camera's frame name while one is in the scene, else undefined to park the
	 * cloud at the world root. `Orphan` is hidden from the world tree until it
	 * resolves, so naming a frame that will never exist drops the cloud out of the
	 * tree altogether while it still draws in the scene.
	 */
	let parentFrame: string | undefined

	const captureCameraPose = () => {
		const cameraFrame = world
			.query(...FRAME_ENTITY_QUERY)
			.find((frame) => frame.get(traits.Name) === name)

		parentFrame = cameraFrame === undefined ? undefined : name

		const cameraWorldMatrix = cameraFrame?.get(traits.WorldMatrix)
		if (!cameraWorldMatrix) {
			// Only while the cloud has never been placed. A camera that drops out of
			// the frame system later keeps the pose it was last pinned at.
			if (!hasCaptureMatrix) logs.add(noFrameWarning, 'warn', warningTarget)
			return
		}

		// The frame arrives after the first points on a cold load, so the warning is
		// routinely true when raised and false a moment later.
		logs.retract(noFrameWarning, 'warn', warningTarget)

		captureMatrix.copy(cameraWorldMatrix)
		hasCaptureMatrix = true
	}

	/**
	 * Pin the cloud to the captured pose, taking `WorldMatrix` over from the
	 * world-matrix system. Left composing through the camera when there was no
	 * pose to sample: following a live camera is wrong, but it beats pinning the
	 * cloud to the world origin.
	 */
	const freezeAtCapture = (target: Entity) => {
		if (!hasCaptureMatrix) return

		const worldMatrix = target.get(traits.WorldMatrix)
		if (worldMatrix) {
			worldMatrix.copy(captureMatrix)
			target.changed(traits.WorldMatrix)
		} else {
			target.add(traits.WorldMatrix(captureMatrix.clone()))
		}

		if (!target.has(traits.MatrixAutoUpdate)) {
			target.add(traits.MatrixAutoUpdate(false))
		}
	}

	let entity: Entity | undefined

	const destroyEntity = () => {
		if (entity && world.has(entity)) {
			entity.destroy()
		}
		entity = undefined
	}

	// TODO: this is a bit of a hack, but there is no better solution currently
	// because pointclouds cannot be returned in world space no are they returned with caputure timestamp
	$effect(() => {
		if (query.isFetching) {
			captureCameraPose()
		}
	})

	$effect(() => {
		const { data } = query
		let disposed = false

		if (!enabled) {
			destroyEntity()
			return
		}

		// No answer yet, which is not the same as a camera answering with no
		// points. A pending query must leave the drawn cloud alone.
		if (data === undefined) {
			return
		}

		if (data.length === 0) {
			destroyEntity()
			return
		}

		parsePcdInWorker(data, settings.current.pointBudget)
			.then(({ boundsTree, positions, colors, bounds, shuffled }) => {
				if (disposed) {
					return
				}

				const metadata = {
					colors,
					colorFormat: ColorFormat.RGB,
				}

				if (entity) {
					hierarchy.setParent(entity, parentFrame)
					const geometry = entity.get(traits.BufferGeometry)

					if (geometry) {
						updateBufferGeometry(geometry, positions, metadata, bounds)
						// Replaces the tree built for the points this refresh just overwrote.
						if (boundsTree) attachPointsBvh(geometry, boundsTree)
						setOrAddTrait(entity, traits.PointSampling, {
							total: positions.length / 3,
							shuffled,
						})
						freezeAtCapture(entity)
						return
					}
				}

				const geometry = createBufferGeometry(positions, metadata, bounds)
				if (boundsTree) attachPointsBvh(geometry, boundsTree)

				entity = world.spawn(
					...hierarchy.parentTraits(parentFrame),
					traits.Name(`${name} pointcloud`),
					traits.BufferGeometry(geometry),
					traits.Points,
					traits.Opacity(1),
					traits.PointSampling({ total: positions.length / 3, shuffled }),
					traits.PointCloudAPI
				)

				freezeAtCapture(entity)
			})
			.catch((error) => {
				if (disposed) {
					return
				}

				logs.add(error?.reason ?? error?.message ?? 'Failed to parse pointcloud', 'error', {
					resource: name,
					folder: 'pointclouds',
				})
			})

		return () => {
			disposed = true
		}
	})

	$effect(() => destroyEntity)
</script>
