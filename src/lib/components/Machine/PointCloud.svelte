<script lang="ts">
	import type { Entity } from 'koota'

	import { CameraClient } from '@viamrobotics/sdk'
	import { createResourceClient, createResourceQuery } from '@viamrobotics/svelte-sdk'

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

	const logTarget = $derived({ resource: name, folder: 'pointclouds' })

	/**
	 * A disabled camera has stopped reporting, so it withdraws what it already
	 * logged rather than leaving its last failure on its tree rows.
	 */
	$effect(() => {
		if (!enabled) return

		const target = logTarget
		return () => logs.retractTarget(target)
	})

	$effect(() => {
		// A disabled query keeps its last error, which would log again on the way out.
		if (!enabled) return

		if (query.isFetching) {
			logs.add(`Fetching pointcloud for ${name}...`, 'info', logTarget)
		} else if (query.error) {
			logs.add(`Error fetching pointcloud from ${name}: ${query.error.message}`, 'error', logTarget)
		}
	})

	const noFrameWarning = $derived(
		`${name} has no frame, drawing its pointcloud at the world origin`
	)

	/**
	 * The camera's frame name while one is in the scene, else undefined to park the
	 * cloud at the world root. `Orphan` is hidden from the world tree until it
	 * resolves, so naming a frame that will never exist drops the cloud out of the
	 * tree altogether while it still draws in the scene.
	 *
	 * Queried straight off the world because this runs from a promise callback,
	 * where a `$derived` registers no dependency.
	 */
	const resolveParentFrame = (): string | undefined => {
		const hasCameraFrame = world
			.query(...FRAME_ENTITY_QUERY)
			.some((frame) => frame.get(traits.Name) === name)

		if (!hasCameraFrame) {
			logs.add(noFrameWarning, 'warn', logTarget)
			return undefined
		}

		// The frame arrives after the first points on a cold load, so the warning is
		// routinely true when raised and false a moment later.
		logs.retract(noFrameWarning, 'warn', logTarget)
		return name
	}

	let entity: Entity | undefined

	const destroyEntity = () => {
		if (entity && world.has(entity)) {
			entity.destroy()
		}
		entity = undefined
	}

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
				const parentFrame = resolveParentFrame()

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
			})
			.catch((error) => {
				if (disposed) {
					return
				}

				logs.add(
					error?.reason ?? error?.message ?? 'Failed to parse pointcloud',
					'error',
					logTarget
				)
			})

		return () => {
			disposed = true
		}
	})

	$effect(() => destroyEntity)
</script>
