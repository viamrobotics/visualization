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
	createFrame: (componentName: string) => void
	updateFrame: (componentName: string, referenceFrame: string, framePosition: {x: number, y: number, z: number, oX: number, oY: number, oZ: number, theta: number}, frameGeometry?: {type: 'none' | 'box' | 'sphere' | 'capsule', r?: number, l?: number, x?: number, y?: number, z?: number}) => void
	saveConfigChanges: () => void
	resetConfigChanges: () => void
	getRobotComponentsWithNoFrame: () => Promise<any[]>
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
		() => [revision, settings.current.viewerMode],
		() => {
			if (settings.current.viewerMode === 'monitor') {
				untrack(() => query.current).refetch({})
				logs.add('Fetching frames...')
			}
		}
	)

	let partConfigNetwork = $state.raw<any>();
	let partConfigLocal = $state<any>();
	let partName = $state<string>();
	let componentNameToFragmentId = $state<Record<string, string>>();

	$effect.pre(() => {
		async function getPartConfig() {
			const partResponse = await appClient.current?.appClient.getRobotPart(partID())
			partConfigNetwork = JSON.parse(partResponse?.configJson ?? '{}')
			partConfigLocal = JSON.parse(partResponse?.configJson ?? '{}')
			partName = partResponse?.part?.name ?? ''

			const result: Record<string, string> = {};
			const fragementRequests = [];
			for (const fragmentId of partConfigNetwork.fragments) {
				fragementRequests.push(appClient.current?.appClient.getFragment(fragmentId))
			}
			const fragementResponses = await Promise.all(fragementRequests)
			for (const fragmentResponse of fragementResponses) {
				const fragmentId = fragmentResponse?.id;
				if (!fragmentId) {
					continue
				}
				const components = fragmentResponse?.fragment?.fields['components'].kind;

				if (components?.case === 'listValue') {
					for (const component of components.value.values) {
						if (component.kind.case === 'structValue') {
							const componentName = component.kind.value.fields['name'].kind;
							if (componentName.case === 'stringValue') {
								result[componentName.value] = fragmentId
							}
						}
					}
				}
			}
			componentNameToFragmentId = result;
		}

		if (appClient?.current) {
			getPartConfig()
		}
	})

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

	$inspect(partConfigNetwork)
	$inspect(current)

	const error = $derived(query.current.error ?? undefined)
	const fetching = $derived(query.current.isFetching)

	const saveConfigChanges = async () => {
		if (!partConfigLocal) {
			return
		}
		await appClient.current?.appClient.updateRobotPart(partID(), partName ?? '', Struct.fromJson(partConfigLocal));
		isDirty = false;
	}

	const resetConfigChanges = () => {
		partConfigLocal = partConfigNetwork
		isDirty = false;
	}

	const createFrame = (componentName: string) => {
		const newConfig = JSON.parse(JSON.stringify(partConfigLocal));
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
		partConfigLocal = newConfig;
		isDirty = true;
	}

	const deleteFrame = (componentName: string) => {
		const newConfig = JSON.parse(JSON.stringify(partConfigLocal));
		const component = newConfig?.components?.find((comp: any) => comp.name === componentName)
		delete component.frame

		const worldObjectIndex = current.findIndex((frame) => frame.name === componentName);
		if (worldObjectIndex !== -1) {
			current.splice(worldObjectIndex, 1);
			current = [...current];
		}

		partConfigLocal = newConfig;
		isDirty = true;
	}

	const setFrameParent = (componentName: string, parentName: string) => {
		const newConfig = JSON.parse(JSON.stringify(partConfigLocal));
		const component = newConfig?.components?.find((comp: any) => comp.name === componentName)
		component.frame.parent = parentName

		const worldObjectIndex = current.findIndex((frame) => frame.name === componentName);
		if (worldObjectIndex !== -1) {
			current[worldObjectIndex].referenceFrame = parentName
			current = [...current]
		}

		partConfigLocal = newConfig;
		isDirty = true;
	}

	const updateFrame = (componentName: string, referenceFrame: string, framePosition: {x: number, y: number, z: number, oX: number, oY: number, oZ: number, theta: number}, frameGeometry?: {type: 'none' | 'box' | 'sphere' | 'capsule', r?: number, l?: number, x?: number, y?: number, z?: number}) => {
		if (componentNameToFragmentId?.[componentName] !== undefined) {
			updateFragmentFrame(componentNameToFragmentId?.[componentName], componentName, referenceFrame, framePosition, frameGeometry)
		} else {
			updatePartFrame(componentName, framePosition, frameGeometry)
		}
		isDirty = true;
	}

	const updateFragmentFrame = (fragmentId: string, componentName: string, referenceFrame: string, framePosition: {x: number, y: number, z: number, oX: number, oY: number, oZ: number, theta: number}, frameGeometry?: {type: 'none' | 'box' | 'sphere' | 'capsule', r?: number, l?: number, x?: number, y?: number, z?: number}) => {
		const newConfig = JSON.parse(JSON.stringify(partConfigLocal));
		if (newConfig.fragment_mods === undefined) {
			newConfig.fragment_mods = []
		}
		let fragmentMod = newConfig.fragment_mods.find((mod: any) => mod.fragment_id === fragmentId)
		if (fragmentMod === undefined) {
			fragmentMod = {
				fragment_id: fragmentId,
				mods: []
			}
			newConfig.fragment_mods.push(fragmentMod)
		}

		const modSetPath = `components.${componentName}.frame`
		const frame = {
			['$set']: {
				[modSetPath]: {
					translation: {
						x: framePosition.x,
						y: framePosition.y,
						z: framePosition.z,
					},
					parent: referenceFrame,
					orientation: {
						type: 'ov_degrees',
						value: {
							x: framePosition.oX,
							y: framePosition.oY,
							z: framePosition.oZ,
							th: framePosition.theta,
						}
					},
					geometry: frameGeometry && frameGeometry.type !== 'none' ? {...frameGeometry} : undefined
				},
			}
		}
		if (frameGeometry === undefined || frameGeometry.type === 'none') {
			delete frame['$set'][modSetPath].geometry
		}

		const existingFrameIndex = fragmentMod.mods.findIndex((mod: any) => mod['$set'][modSetPath] !== undefined)
		if (existingFrameIndex !== -1) {
			const existingGeometry = fragmentMod.mods[existingFrameIndex]['$set'][modSetPath].geometry
			if (existingGeometry) {
				frame['$set'][modSetPath].geometry = existingGeometry
			}
			fragmentMod.mods[existingFrameIndex] = frame
		} else {
			fragmentMod.mods.push(frame)
		}

		partConfigLocal = newConfig;
	}

	const updatePartFrame = (componentName: string, framePosition: {x: number, y: number, z: number, oX: number, oY: number, oZ: number, theta: number}, frameGeometry?: {type: 'none' | 'box' | 'sphere' | 'capsule', r?: number, l?: number, x?: number, y?: number, z?: number}) => {
		console.log('updatePartFrame', componentName)
		const newConfig = JSON.parse(JSON.stringify(partConfigLocal));
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
				if (frameGeometry.type === 'none') {
					delete component.frame.geometry
				} else {
					component.frame.geometry = {...frameGeometry}
				}
			}
		}

		partConfigLocal = newConfig;
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


	const getRobotComponentsWithNoFrame = () => {
		return partConfigLocal?.components?.filter((comp: any) => !comp.frame)
	}

	setContext<FramesContext>(key, {
		saveConfigChanges,
		resetConfigChanges,
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
