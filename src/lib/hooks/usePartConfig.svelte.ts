import type { JsonObject } from '@bufbuild/protobuf'
import type { JsonValue } from '@viamrobotics/sdk'

import { Pose, Struct } from '@viamrobotics/sdk'
import { createAppQuery, useViamClient } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

import { createFrame, type Frame } from '$lib/frame'
import { createPoseFromFrame } from '$lib/transform'

const key = Symbol('part-config-context')

export interface PartConfig {
	components: { name: string; api?: string; frame?: Frame }[]
	fragment_mods?: {
		fragment_id: string
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		mods: any[]
	}[]
}

interface LocalPartConfig {
	isDirty: boolean
	hasPendingSave: boolean
	hasEditPermissions: boolean
	current: Struct
	componentNameToFragmentId: Record<string, string>

	set: (config: PartConfig) => void
	save?: () => void
	discardChanges?: () => void
	clearPendingSave: () => void
	setPendingSave: () => void
}

interface PartConfigContext {
	current: PartConfig
	isDirty: boolean
	hasPendingSave: boolean
	hasEditPermissions: boolean
	componentNameToFragmentId: Record<string, string>

	updateFrame: (
		componentName: string,
		referenceFrame: string,
		pose: Pose,
		geometry?: Frame['geometry']
	) => void
	deleteFrame: (componentName: string) => void
	createFrame: (componentName: string) => void
	save: () => void
	discardChanges: () => void
	clearPendingSave: () => void
	setPendingSave: () => void
}

export const providePartConfig = (
	partID: () => string,
	params: () => AppEmbeddedPartConfigProps | undefined
) => {
	const props = $derived(params())
	const config = $derived(props ? useEmbeddedPartConfig(props) : useStandalonePartConfig(partID))

	const getCurrent = () => {
		return (config.current.toJson?.() ?? { components: [] }) as unknown as PartConfig
	}

	const current = $derived(getCurrent())

	const createFragmentFrame = (fragmentId: string, componentName: string) => {
		const newConfig = getCurrent()
		newConfig.fragment_mods ??= []

		let fragmentMod = newConfig.fragment_mods.find((mod) => mod.fragment_id === fragmentId)
		if (fragmentMod === undefined) {
			fragmentMod = {
				fragment_id: fragmentId,
				mods: [],
			}
			newConfig.fragment_mods.push(fragmentMod)
		}

		const modSetPath = `components.${componentName}.frame`
		const frame = {
			['$set']: {
				[modSetPath]: createFrame(),
			},
		}

		fragmentMod.mods.push(frame)
		config.set(newConfig)
	}

	const createPartFrame = (componentName: string) => {
		const newConfig = getCurrent()
		const component = newConfig?.components?.find((comp) => comp.name === componentName)
		if (component) {
			component.frame = createFrame()
		}
		config.set(newConfig)
	}

	const updateFragmentFrame = (
		fragmentId: string,
		componentName: string,
		referenceFrame: string,
		framePosition: Pose,
		frameGeometry?: Frame['geometry']
	) => {
		const newConfig = getCurrent()
		newConfig.fragment_mods ??= []

		let fragmentMod = newConfig.fragment_mods.find(
			(mod: { fragment_id: string }) => mod.fragment_id === fragmentId
		)
		if (fragmentMod === undefined) {
			fragmentMod = {
				fragment_id: fragmentId,
				mods: [],
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
						},
					},
					geometry:
						frameGeometry && frameGeometry.type !== 'none' ? { ...frameGeometry } : undefined,
				},
			},
		}
		if (frameGeometry === undefined || frameGeometry.type === 'none') {
			delete frame['$set'][modSetPath].geometry
		}

		const existingFrameIndex = fragmentMod.mods.findLastIndex(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(mod: any) => mod?.['$set']?.[modSetPath] !== undefined
		)
		if (existingFrameIndex === -1) {
			fragmentMod.mods.push(frame)
		} else {
			const existingGeometry = fragmentMod.mods[existingFrameIndex]['$set']?.[modSetPath].geometry
			if (existingGeometry && !frameGeometry) {
				frame['$set'][modSetPath].geometry = existingGeometry
			}
			fragmentMod.mods[existingFrameIndex] = frame
		}

		config.set(newConfig)
	}

	const updatePartFrame = (
		componentName: string,
		referenceFrame: string,
		pose: Pose,
		geometry?: Frame['geometry']
	) => {
		const newConfig = getCurrent()
		const component = newConfig.components?.find(({ name }) => name === componentName)

		if (!component) {
			return
		}

		if (component.frame) {
			const currentPose = createPoseFromFrame(component.frame)

			component.frame.parent = referenceFrame
			component.frame.translation = {
				x: pose.x ?? currentPose.x,
				y: pose.y ?? currentPose.y,
				z: pose.z ?? currentPose.z,
			}
			component.frame.orientation.type = 'ov_degrees'
			component.frame.orientation.value = {
				x: pose.oX ?? currentPose.oX,
				y: pose.oY ?? currentPose.oY,
				z: pose.oZ ?? currentPose.oZ,
				th: pose.theta ?? currentPose.theta,
			}
			if (geometry) {
				if (geometry.type === 'none') {
					delete component.frame.geometry
				} else {
					component.frame.geometry = { ...geometry }
				}
			}
		}

		config.set(newConfig)
	}

	const deletePartFrame = (componentName: string) => {
		const newConfig = getCurrent()
		const component = newConfig?.components?.find(({ name }) => name === componentName)

		if (component) {
			delete component.frame
			config.set(newConfig)
		}
	}

	const deleteFragmentFrame = (fragmentId: string, componentName: string) => {
		const newConfig = getCurrent()
		newConfig.fragment_mods ??= []

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let fragmentMod = newConfig.fragment_mods.find((mod: any) => mod.fragment_id === fragmentId)
		if (fragmentMod === undefined) {
			fragmentMod = {
				fragment_id: fragmentId,
				mods: [],
			}
			newConfig.fragment_mods.push(fragmentMod)
		}

		const modUnSetPath = `components.${componentName}.frame`
		fragmentMod.mods.push({
			['$unset']: {
				[modUnSetPath]: '',
			},
		})
		config.set(newConfig)
	}

	setContext<PartConfigContext>(key, {
		get current() {
			return current
		},
		get componentNameToFragmentId() {
			return config.componentNameToFragmentId
		},
		get isDirty() {
			return config.isDirty
		},
		get hasPendingSave() {
			return config.hasPendingSave
		},
		get hasEditPermissions() {
			return config.hasEditPermissions
		},

		updateFrame: (
			componentName: string,
			referenceFrame: string,
			framePosition: Pose,
			frameGeometry?: Frame['geometry']
		) => {
			const fragmentId = config.componentNameToFragmentId[componentName]
			if (fragmentId === undefined) {
				updatePartFrame(componentName, referenceFrame, framePosition, frameGeometry)
			} else {
				updateFragmentFrame(fragmentId, componentName, referenceFrame, framePosition, frameGeometry)
			}
		},

		deleteFrame: (componentName: string) => {
			const fragmentId = config.componentNameToFragmentId[componentName]
			if (fragmentId === undefined) {
				deletePartFrame(componentName)
			} else {
				deleteFragmentFrame(fragmentId, componentName)
			}
		},
		createFrame: (componentName: string) => {
			const fragmentId = config.componentNameToFragmentId[componentName]
			if (fragmentId === undefined) {
				createPartFrame(componentName)
			} else {
				createFragmentFrame(fragmentId, componentName)
			}
		},
		save: () => config.save?.(),
		discardChanges: () => config.discardChanges?.(),
		clearPendingSave: () => config.clearPendingSave(),
		setPendingSave: () => config.setPendingSave(),
	})
}

export const usePartConfig = (): PartConfigContext => {
	return getContext<PartConfigContext>(key)
}

interface AppEmbeddedPartConfigProps {
	current: Struct
	isDirty: boolean
	componentToFragId: Record<string, string>

	setLocalPartConfig: (config: Struct) => void
}

const useEmbeddedPartConfig = (props: AppEmbeddedPartConfigProps): LocalPartConfig => {
	return {
		hasEditPermissions: true,
		hasPendingSave: false,
		get isDirty() {
			return props.isDirty
		},

		get current() {
			return props.current ?? new Struct()
		},

		get componentNameToFragmentId() {
			return props.componentToFragId
		},

		set(config: PartConfig): void {
			const struct = Struct.fromJson(config as unknown as JsonValue)
			return props.setLocalPartConfig(struct)
		},

		clearPendingSave() {},
		setPendingSave() {},
	}
}

const useStandalonePartConfig = (partID: () => string): LocalPartConfig => {
	const partQuery = createAppQuery('getRobotPart', () => [partID()] as const, {
		refetchInterval: false,
	})
	const partName = $derived(partQuery.data?.part?.name)

	// Use part.robotConfig (the stored Struct config) as the authoritative source.
	// configJson is the compiled running config from the robot daemon and may be empty
	// even when the stored config exists and the API key has edit permissions.
	let networkPartConfig = $derived(partQuery.data?.part?.robotConfig)
	let current = $state.raw<Struct>()
	let isDirty = $state(false)
	let hasPendingSave = $state(false)

	const hasEditPermissions = $derived(networkPartConfig !== undefined)

	const configJSON = $derived.by(() => {
		if (!networkPartConfig) {
			return undefined
		}
		try {
			return networkPartConfig.toJson() as JsonObject
		} catch {
			return undefined
		}
	})

	const fragmentQueries = $derived(
		((configJSON?.fragments ?? []) as (string | { id: string })[]).map((fragmentId) => {
			const id = typeof fragmentId === 'string' ? fragmentId : fragmentId.id
			return createAppQuery('getFragment', () => [id] as const, { refetchInterval: false })
		})
	)

	const componentNameToFragmentId = $derived.by(() => {
		const results: Record<string, string> = {}
		for (const query of fragmentQueries) {
			if (!query.data) {
				continue
			}

			const fragmentId = query.data.id
			const components = query.data?.fragment?.fields['components']?.kind

			if (components?.case === 'listValue') {
				for (const component of components.value.values) {
					if (component.kind.case === 'structValue') {
						const componentName = component.kind.value.fields['name']?.kind
						if (componentName.case === 'stringValue') {
							results[componentName.value] = fragmentId
						}
					}
				}
			}
		}

		return results
	})

	let lastPartID: string | undefined
	$effect.pre(() => {
		const id = partID()
		if (lastPartID !== undefined && lastPartID !== id) {
			// Part changed: drop any in-memory edits/pending-save state from the
			// previous part. `current` is left for the existing sync below to
			// repopulate once the new part's networkPartConfig arrives.
			isDirty = false
			hasPendingSave = false
		}
		lastPartID = id

		if (!networkPartConfig || isDirty) {
			return
		}

		current = networkPartConfig
	})

	const viamClient = useViamClient()

	// HACK(motion-tools): the SDK's `AppClient.updateRobotPart(id, name, robotConfig)`
	// wrapper does not forward the new optional `robot_config_json` field on
	// `UpdateRobotPartRequest`. The server now treats the absence of that field as
	// "clear the stored config_json," which breaks subsequent reads. Until the
	// upstream SDK wrapper accepts the field (see Slack 2026-03 thread),
	// bypass the wrapper and call the underlying Connect client directly with both
	// `robotConfig` and a JSON-marshalled `robotConfigJson`.
	//
	// Remove this bypass once @viamrobotics/sdk exposes the parameter and switch
	// back to `createAppMutation('updateRobotPart')`.
	const updateRobotPart = async (id: string, name: string, robotConfig: Struct) => {
		const client = viamClient.current?.appClient
		if (!client) {
			throw new Error('Viam app client not ready')
		}
		// `appClient.client` is the underlying Connect PromiseClient<AppService>.
		// Its `updateRobotPart` accepts any field defined on UpdateRobotPartRequest
		// in the generated proto, which at @viamrobotics/sdk@0.69.0 includes
		// `robotConfigJson`.
		const connect = (
			client as unknown as { client: { updateRobotPart: (req: unknown) => Promise<unknown> } }
		).client
		const robotConfigJson = JSON.stringify(robotConfig.toJson())
		await connect.updateRobotPart({ id, name, robotConfig, robotConfigJson })
	}

	return {
		get current() {
			return current ?? new Struct()
		},
		get isDirty() {
			return isDirty
		},
		get hasPendingSave() {
			return hasPendingSave
		},
		get hasEditPermissions() {
			return hasEditPermissions
		},
		get componentNameToFragmentId() {
			return componentNameToFragmentId
		},

		set(config: PartConfig): void {
			current = Struct.fromJson(config as unknown as JsonValue)
			isDirty = true
		},

		async save() {
			if (!current || !partName) {
				return
			}

			networkPartConfig = current
			await updateRobotPart(partID(), partName, current)
			isDirty = false
			hasPendingSave = true
		},

		discardChanges() {
			current = networkPartConfig
			isDirty = false
		},

		clearPendingSave() {
			hasPendingSave = false
		},

		setPendingSave() {
			hasPendingSave = true
		},
	}
}
