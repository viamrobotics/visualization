<script lang="ts">
	import type { ConfigurableTrait, Entity } from 'koota'

	import { VisionClient } from '@viamrobotics/sdk'
	import { createResourceClient, createResourceQuery } from '@viamrobotics/svelte-sdk'
	import { Matrix4 } from 'three'

	import { createBufferGeometry, updateBufferGeometry } from '$lib/attribute'
	import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
	import { RefetchRates } from '$lib/components/overlay/refetchRates'
	import { hierarchy, setOrAddTrait, traits, useWorld } from '$lib/ecs'
	import { usePointcloudObjects } from '$lib/hooks/usePointcloudObjects.svelte'
	import { RefreshRates, useSettings } from '$lib/hooks/useSettings.svelte'
	import { parsePcdInWorker } from '$lib/loaders/pcd'
	import { Pose } from '$lib/math'
	import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'
	import { attachPointsBvh } from '$lib/three/pointsBvh'

	interface Props {
		partID: string
		/** The vision service whose objects this draws. */
		name: string
	}

	let { partID, name }: Props = $props()

	const matrix4 = new Matrix4()

	const world = useWorld()
	const logs = useLogs()
	const settings = useSettings()
	const { refetchers } = usePointcloudObjects()
	const { refreshRates, disabledVisionServices } = $derived(settings.current)

	const client = createResourceClient(
		VisionClient,
		() => partID,
		() => name
	)

	const properties = createResourceQuery(client, 'getProperties', {
		staleTime: Infinity,
		refetchOnMount: false,
		refetchInterval: false,
	})

	const interval = $derived(refreshRates[RefreshRates.vision])

	const enabled = $derived(
		properties.isPending === false &&
			interval !== RefetchRates.OFF &&
			disabledVisionServices[name] !== true
	)

	const query = createResourceQuery(client, 'getObjectPointClouds', [''], () => ({
		enabled,
		// The chosen refresh rate should be the only thing that fetches.
		refetchOnWindowFocus: false,
		refetchInterval: (interval === RefetchRates.MANUAL ? false : interval) as number | false,
	}))

	/**
	 * A service that cannot serve pointcloud objects is disabled once, and a user
	 * can still turn it back on by hand.
	 */
	$effect(() => {
		if (
			properties.data?.objectPointCloudsSupported === false &&
			disabledVisionServices[name] === undefined
		) {
			disabledVisionServices[name] = true
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
				folder: 'pointcloud-objects',
			})
		} else if (query.error) {
			logs.add(`Error fetching pointcloud from ${name}: ${query.error.message}`, 'error', {
				resource: name,
				folder: 'pointcloud-objects',
			})
		}
	})

	const entities = new Map<string, Entity>()
	let drawnKeys = new Set<string>()

	const destroyEntity = (label: string) => {
		const entity = entities.get(label)
		if (entity) {
			if (world.has(entity)) entity.destroy()
			entities.delete(label)
		}
	}

	const destroyAll = () => {
		for (const entity of entities.values()) {
			if (world.has(entity)) entity.destroy()
		}
		entities.clear()
		drawnKeys = new Set()
	}

	$effect(() => {
		const { data } = query
		let disposed = false
		const nextKeys = new Set<string>()

		const reconcileRemovedKeys = () => {
			for (const label of drawnKeys) {
				if (!nextKeys.has(label)) {
					destroyEntity(label)
				}
			}

			drawnKeys = new Set(nextKeys)
		}

		if (!enabled) {
			destroyAll()
			return
		}

		// No answer yet, which is not the same as a service answering with no
		// objects. A pending query must leave the drawn ones alone.
		if (data === undefined) {
			return
		}

		if (data.length === 0) {
			reconcileRemovedKeys()
			return
		}

		let index = 0

		for (const { geometries: geometriesInFrame, pointCloud } of data) {
			if (pointCloud.length > 0) {
				const pointcloudLabel = `${name} pointcloud ${index + 1}`
				nextKeys.add(pointcloudLabel)

				parsePcdInWorker(pointCloud, settings.current.pointBudget)
					.then(({ boundsTree, positions, colors, bounds, shuffled }) => {
						if (disposed || !nextKeys.has(pointcloudLabel)) {
							return
						}

						const existing = entities.get(pointcloudLabel)
						const metadata = {
							colors,
							colorFormat: ColorFormat.RGB,
						}

						if (existing) {
							const geometry = existing.get(traits.BufferGeometry)

							if (geometry) {
								updateBufferGeometry(geometry, positions, metadata, bounds)
								// Replaces the tree built for the points this refresh just overwrote.
								if (boundsTree) attachPointsBvh(geometry, boundsTree)
								setOrAddTrait(existing, traits.PointSampling, {
									total: positions.length / 3,
									shuffled,
								})
							}
						} else {
							const geometry = createBufferGeometry(positions, metadata, bounds)
							if (boundsTree) attachPointsBvh(geometry, boundsTree)

							const entity = world.spawn(
								traits.Name(pointcloudLabel),
								traits.BufferGeometry(geometry),
								traits.Points,
								traits.PointSampling({ total: positions.length / 3, shuffled }),
								traits.PointCloudObjectAPI
							)

							entities.set(pointcloudLabel, entity)
						}
					})
					.catch((error) => {
						if (disposed) {
							return
						}

						logs.add(error?.reason ?? error?.message ?? 'Failed to parse pointcloud', 'error', {
							resource: name,
							folder: 'pointcloud-objects',
						})
					})
			}

			if (geometriesInFrame) {
				let geometryIndex = 0

				for (const geometry of geometriesInFrame.geometries) {
					const geometryLabel = `${name} pointcloud ${index + 1} geometry ${geometryIndex + 1}`

					nextKeys.add(geometryLabel)

					const center = new Pose().copy(geometry.center)
					const existing = entities.get(geometryLabel)

					if (existing) {
						hierarchy.setParent(existing, geometriesInFrame.referenceFrame)
						center.toMatrix4(matrix4)
						const matrix = existing.get(traits.Matrix)
						if (matrix && !matrix.equals(matrix4)) {
							matrix.copy(matrix4)
							existing.changed(traits.Matrix)
						}
						traits.updateGeometryTrait(existing, geometry)
					} else {
						const entityTraits: ConfigurableTrait[] = [
							traits.Name(geometryLabel),
							...hierarchy.parentTraits(geometriesInFrame.referenceFrame),
							traits.Matrix(center.toMatrix4()),
							traits.Geometry(geometry),
							traits.Color({ r: 0, g: 1, b: 0 }),
							traits.PointCloudObjectAPI,
						]

						const entity = world.spawn(...entityTraits)

						entities.set(geometryLabel, entity)
					}

					geometryIndex += 1
				}
			}

			index += 1
		}

		reconcileRemovedKeys()

		return () => {
			disposed = true
		}
	})

	$effect(() => destroyAll)
</script>
