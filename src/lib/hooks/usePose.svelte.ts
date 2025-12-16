import {
	createResourceClient,
	createResourceQuery,
	createRobotQuery,
	useRobotClient,
} from '@viamrobotics/svelte-sdk'
import { usePartID } from './usePartID.svelte'
import { commonApi, MotionClient, Pose, Transform } from '@viamrobotics/sdk'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { useEnvironment } from './useEnvironment.svelte'
import { observe } from '@threlte/core'
import { untrack } from 'svelte'
import { useFrames } from './useFrames.svelte'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'
import { useLogs } from './useLogs.svelte'
import { useResourceByName } from './useResourceByName.svelte'
import { useRefetchPoses } from './useRefetchPoses'
import { useMotionClient } from './useMotionClient.svelte'
import diff from 'microdiff'

export const usePose = (name: () => string | undefined, parent: () => string | undefined) => {
	const environment = useEnvironment()
	const logs = useLogs()
	const { refreshRates } = useMachineSettings()
	const partID = usePartID()
	const robotClient = useRobotClient(() => partID.current)
	const motionClient = useMotionClient()
	const currentName = $derived(name())
	const currentParent = $derived(parent())
	const resourceByName = useResourceByName()
	const { addQueryToRefetch } = useRefetchPoses()

	const resource = $derived(currentName ? resourceByName.current[currentName] : undefined)
	const parentResource = $derived(currentParent ? resourceByName.current[currentParent] : undefined)
	const frames = useFrames()
	let pose = $state<Pose | undefined>(undefined)

	const interval = $derived(refreshRates.get(RefreshRates.poses))

	const resolvedParent = $derived(
		parentResource?.subtype === 'arm' || parentResource?.subtype === 'gantry'
			? `${parent()}_origin`
			: parent()
	)

	const query = createRobotQuery(
		robotClient,
		'getPose',
		() => [currentName, resolvedParent ?? 'world', []] as [string, string, commonApi.Transform[]],
		() => ({
			enabled: interval !== RefetchRates.OFF && environment.current.viewerMode === 'monitor',
			refetchInterval: interval === RefetchRates.MANUAL ? false : interval,
		})
	)

	const client = createResourceClient(
		MotionClient,
		() => partID.current,
		() => motionClient.current ?? ''
	)

	const motionQuery = createResourceQuery(
		client,
		'getPose',
		() => [currentName, resolvedParent ?? 'world', []] as [string, string, Transform[]],
		() => ({
			enabled: interval !== RefetchRates.OFF && environment.current.viewerMode === 'monitor',
			refetchInterval: interval === RefetchRates.MANUAL ? false : interval,
		})
	)

	$effect(() => {
		if (environment.current.viewerMode === 'monitor') {
			pose = query.data?.pose
		}
	})

	$effect(() => {
		addQueryToRefetch(query)
		addQueryToRefetch(motionQuery)
	})

	$effect(() => {
		if (query.isFetching) {
			logs.add(`Fetching pose for ${currentName}...`)
		} else if (query.error) {
			logs.add(`Error fetching pose for ${currentName}: ${query.error.message}`, 'error')
		}
	})

	observe.pre(
		() => [environment.current.viewerMode, frames.current],
		() => {
			if (environment.current.viewerMode === 'monitor') {
				untrack(() => query.refetch())
				untrack(() => motionQuery.refetch())
			}
		}
	)

	$inspect(query.data?.pose).with((_, val) => console.log(`${currentName} robot query pose`, val))
	$inspect(motionQuery.data?.pose).with((_, val) =>
		console.log(`${currentName} motion query pose`, val)
	)
	$inspect(diff(query.data?.pose ?? {}, motionQuery.data?.pose ?? {})).with((_, val) =>
		console.log(`${currentName} pose diff`, val)
	)

	return {
		get current() {
			/**
			 * Do not return the pose of an arm or gantry because in this case the pose represents
			 * the end effector frame and not the origin frame
			 */
			if (resource?.subtype === 'arm' || resource?.subtype === 'gantry') {
				return
			}
			return pose
		},
	}
}
