import { getContext, setContext, untrack } from 'svelte'
import {
	useRobotClient,
	createRobotQuery,
	useMachineStatus,
	useResourceNames,
	useViamClient,
} from '@viamrobotics/svelte-sdk'
import { WorldObject } from '$lib/WorldObject.svelte'
import { observe } from '@threlte/core'
import { useLogs } from './useLogs.svelte'
import { resourceColors } from '$lib/color'
import type { Geometries, Metadata } from '$lib/WorldObject.svelte'
import { Struct } from '@viamrobotics/sdk'

interface FramesContext {
	current: WorldObject[]
	error?: Error
	fetching: boolean
	isDirty: boolean
	updateFrame: (uuid: string, componentName: string, framePosition: {x?: number, y?: number, z?: number, oX?: number, oY?: number, oZ?: number, theta?: number}, frameGeometry?: {type: 'none' | 'box' | 'sphere' | 'capsule', r?: number, l?: number, x?: number, y?: number, z?: number}) => void
}

export interface FrameHeirachyNode {
	name: string
	parentName: string
	object: WorldObject<Geometries>
	children: FrameHeirachyNode[]
}


const key = Symbol('frames-context')

export const provideFrames = (partID: () => string) => {
	const resourceNames = useResourceNames(partID)
	const client = useRobotClient(partID)
	const machineStatus = useMachineStatus(partID)
	const logs = useLogs()
	const query = createRobotQuery(client, 'frameSystemConfig')
	const revision = $derived(machineStatus.current?.config.revision)
	const appClient = useViamClient();
	let isDirty = $state(false)

	observe.pre(
		() => [revision],
		() => {
			untrack(() => query.current).refetch({})
			untrack(() => isDirty = false)
			logs.add('Fetching frames...')
		}
	)

	const current = $derived.by(() => {
		const objects: WorldObject[] = []

		for (const { frame } of query.current.data ?? []) {
			if (frame === undefined) {
				continue
			}

			const resourceName = resourceNames.current.find((item) => item.name === frame.referenceFrame)
			const metadata: Metadata = {
				partID: partID(),	
			}
			if (resourceName) {
				metadata.color = resourceColors[resourceName.subtype as keyof typeof resourceColors]
			}

			objects.push(
				new WorldObject(
					frame.referenceFrame ? frame.referenceFrame : 'Unnamed frame',
					frame.poseInObserverFrame?.pose,
					frame.poseInObserverFrame?.referenceFrame,
					frame.physicalObject?.geometryType,
					metadata
				)
			)
		}

		return objects
	})
	const error = $derived(query.current.error ?? undefined)
	const fetching = $derived(query.current.isFetching)

	const updateFrame = async (uuid: string, componentName: string, framePosition: {x?: number, y?: number, z?: number, oX?: number, oY?: number, oZ?: number, theta?: number}, frameGeometry?: {type: 'none' | 'box' | 'sphere' | 'capsule', r?: number, l?: number, x?: number, y?: number, z?: number}) => {
		const partResponse = await appClient.current?.appClient.getRobotPart(uuid)
		const partName = partResponse?.part?.name;

		const newConfig = JSON.parse(partResponse?.configJson ?? '{}')
		const component = newConfig?.components?.find((comp: any) => comp.name === componentName)
		if (component && component.frame) {
			component.frame.translation = {
				x: framePosition.x === undefined ? component.frame.translation.x : framePosition.x,
				y: framePosition.y === undefined ? component.frame.translation.y : framePosition.y,
				z: framePosition.z === undefined ? component.frame.translation.z : framePosition.z,
			}
			component.frame.orientation.value = {
				x: framePosition.oX === undefined ? component.frame.orientation.value.x : framePosition.oX,
				y: framePosition.oY === undefined ? component.frame.orientation.value.y : framePosition.oY,
				z: framePosition.oZ === undefined ? component.frame.orientation.value.z : framePosition.oZ,
				th: framePosition.theta === undefined ? component.frame.orientation.value.th : framePosition.theta,
			}
			if (frameGeometry) {
				isDirty = true
				if (frameGeometry.type === 'none') {
					delete component.frame.geometry
				} else {
					component.frame.geometry = {...frameGeometry}
				}
			}
		}

		appClient.current?.appClient.updateRobotPart(uuid, partName ?? '', Struct.fromJson(newConfig));
	}

	setContext<FramesContext>(key, {
		updateFrame,
		get current() {
			return current
		},
		get error() {
			return error
		},
		get fetching() {
			return fetching
		},
		get isDirty() {
			return isDirty
		},
	})
}

export const useFrames = (): FramesContext => {
	return getContext<FramesContext>(key)
}
