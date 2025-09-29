import { getContext, setContext, untrack } from 'svelte'
import {
	useRobotClient,
	createRobotQuery,
	useMachineStatus,
	useResourceNames,
	useViamClient,
	createAppQuery,
} from '@viamrobotics/svelte-sdk'
import { WorldObject } from '$lib/WorldObject.svelte'
import { observe } from '@threlte/core'
import { useLogs } from './useLogs.svelte'
import { resourceColors } from '$lib/color'
import type { Geometries, Metadata } from '$lib/WorldObject.svelte'
import { Struct } from '@viamrobotics/sdk'
import { useSettings } from './useSettings.svelte'

interface FramesContext {
	current: WorldObject[]
	error?: Error
	fetching: boolean
	isDirty: boolean
	setFrameParent: (componentName: string, parentName: string) => void
	deleteFrame: (componentName: string) => void
	createFrame: (uuid: string, componentName: string) => void
	updateFrame: (uuid: string, componentName: string, framePosition: {x?: number, y?: number, z?: number, oX?: number, oY?: number, oZ?: number, theta?: number}, frameGeometry?: {type: 'none' | 'box' | 'sphere' | 'capsule', r?: number, l?: number, x?: number, y?: number, z?: number}) => void
	getRobotComponentsWithNoFrame: (uuid: string) => Promise<any[]>
	getParentFrameOptions: (componentName: string) => string[]
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
	const settings = useSettings()

	const revision = $derived(machineStatus.current?.config.revision)
	const appClient = useViamClient();
	// MATTHEW: this api does not work 
	// const robotPartQuery = createAppQuery('getRobotPart', ["9b304d77-b1d5-4c96-a64f-4088772b9961"])

	// $inspect(robotPartQuery.current.data)

	let isDirty = $state(false)

	observe.pre(
		() => [revision],
		() => {
			if (settings.current.viewerMode === 'monitor') {
				untrack(() => query.current).refetch({})
				untrack(() => isDirty = false)
				logs.add('Fetching frames...')
			}
		}
	)

	let current = $derived.by(() => {
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

	const createFrame = async (uuid: string, componentName: string) => {
		const partResponse = await appClient.current?.appClient.getRobotPart(uuid)
		const partName = partResponse?.part?.name;
		const newConfig = JSON.parse(partResponse?.configJson ?? '{}')
		const component = newConfig?.components?.find((comp: any) => comp.name === componentName)
		if (component) {
			component.frame = {
				parent: "world",
				translation: {
					x: 0,
					y: 0,
					z: 0,
				},
				orientation: {
					type: 'ov_degrees',
					value: {
						x: 0,
						y: 0,
						z: 1,
						th: 0,
					},
				},
				geometry: {
					type: 'box',
					x: 100,
					y: 100,
					z: 100,
				},
			}
		}

		current.push(new WorldObject(componentName, {x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0}, 'world', {
			case: 'box',
			value: {
				dimsMm: {
					x: 100,
					y: 100,
					z: 100,
				},
			},
		}));
		current = [...current];
		appClient.current?.appClient.updateRobotPart(uuid, partName ?? '', Struct.fromJson(newConfig));
	}

	const deleteFrame = async (componentName: string) => {
		const partResponse = await appClient.current?.appClient.getRobotPart(partID())
		const partName = partResponse?.part?.name;
		const newConfig = JSON.parse(partResponse?.configJson ?? '{}')
		const component = newConfig?.components?.find((comp: any) => comp.name === componentName)
		delete component.frame

		const worldObjectIndex = current.findIndex((frame) => frame.name === componentName);
		if (worldObjectIndex !== -1) {
			current.splice(worldObjectIndex, 1);
			current = [...current];
		}

		appClient.current?.appClient.updateRobotPart(partID(), partName ?? '', Struct.fromJson(newConfig));
	}

	const setFrameParent = async (componentName: string, parentName: string) => {
		const partResponse = await appClient.current?.appClient.getRobotPart(partID())
		const partName = partResponse?.part?.name;
		const newConfig = JSON.parse(partResponse?.configJson ?? '{}')
		const component = newConfig?.components?.find((comp: any) => comp.name === componentName)
		component.frame.parent = parentName

		const worldObjectIndex = current.findIndex((frame) => frame.name === componentName);
		if (worldObjectIndex !== -1) {
			current[worldObjectIndex].referenceFrame = parentName
			current = [...current]
		}

		appClient.current?.appClient.updateRobotPart(partID(), partName ?? '', Struct.fromJson(newConfig));
	}

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

	const getParentFrameOptions = (componentName: string) => {
		const validFrames = new Set(current.map((frame) => frame.name));
		validFrames.add("world");

		const frameNameQueue = [componentName];
		while (frameNameQueue.length > 0) {
			const frameName = frameNameQueue.shift();
			if (frameName) {
				validFrames.delete(frameName);
				const frames = current.filter((frame) => frame.referenceFrame === frameName);
				for (const frame of frames) {
					frameNameQueue.push(frame.name);
				}
			}
		}
		return Array.from(validFrames);
	}


	const getRobotComponentsWithNoFrame = async (uuid: string) => {
		// MATTHEW: this is hard to create a local version for allowing local vs network state sync
		if (!appClient) {
			return []
		}
		const partResponse = await appClient.current?.appClient.getRobotPart(uuid)
		const config = JSON.parse(partResponse?.configJson ?? '{}')
		return config?.components?.filter((comp: any) => !comp.frame)
	}

	setContext<FramesContext>(key, {
		updateFrame,
		createFrame,
		deleteFrame,
		setFrameParent,
		getParentFrameOptions,
		get current() {
			return current
		},
		get getRobotComponentsWithNoFrame() {
			return getRobotComponentsWithNoFrame
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
