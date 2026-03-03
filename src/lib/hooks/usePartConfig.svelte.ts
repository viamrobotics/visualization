import { type Frame, createFrame } from '$lib/frame'
import { createPoseFromFrame } from '$lib/transform'
import { Struct, Pose } from '@viamrobotics/sdk'
import type { JsonValue } from '@viamrobotics/sdk'
import { useViamClient } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('part-config-context')

export interface PartConfig {
	components: { name: string; frame?: Frame }[]
	fragment_mods?: {
		fragment_id: string
		mods: any[]
	}[]
}

interface LocalPartConfig {
	isDirty: boolean
	hasEditPermissions: boolean
	current: Struct
	componentNameToFragmentId: Record<string, string>

	set: (config: PartConfig) => void
	save?: () => void
	discardChanges?: () => void
}

interface PartConfigContext {
	current: PartConfig
	isDirty: boolean
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
}

export const providePartConfig = (
	partID: () => string,
	params: () => AppEmbeddedPartConfigProps | undefined
) => {
	const props = $derived(params())

	let config = $derived(props ? useEmbeddedPartConfig(props) : useStandalonePartConfig(partID))
	const current = $derived(
		(config.current.toJson?.() ?? { components: [] }) as unknown as PartConfig
	)

	const createFragmentFrame = (fragmentId: string, componentName: string) => {
		const newConfig = current
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
		const newConfig = current
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
		const newConfig = current
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
		if (existingFrameIndex !== -1) {
			const existingGeometry = fragmentMod.mods[existingFrameIndex]['$set']?.[modSetPath].geometry
			if (existingGeometry && !frameGeometry) {
				frame['$set'][modSetPath].geometry = existingGeometry
			}
			fragmentMod.mods[existingFrameIndex] = frame
		} else {
			fragmentMod.mods.push(frame)
		}

		config.set(newConfig)
	}

	const updatePartFrame = (
		componentName: string,
		referenceFrame: string,
		pose: Pose,
		geometry?: Frame['geometry']
	) => {
		const newConfig = current
		const component = newConfig?.components?.find(
			(comp: { name: string }) => comp.name === componentName
		)

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
		const newConfig = current
		const component = newConfig?.components?.find(
			(comp: { name: string }) => comp.name === componentName
		)
		if (!component) {
			return
		}
		delete component.frame
		config.set(newConfig)
	}

	const deleteFragmentFrame = (fragmentId: string, componentName: string) => {
		const newConfig = current
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
			if (fragmentId !== undefined) {
				updateFragmentFrame(fragmentId, componentName, referenceFrame, framePosition, frameGeometry)
			} else {
				updatePartFrame(componentName, referenceFrame, framePosition, frameGeometry)
			}
		},
		deleteFrame: (componentName: string) => {
			const fragmentId = config.componentNameToFragmentId[componentName]
			if (fragmentId !== undefined) {
				deleteFragmentFrame(fragmentId, componentName)
			} else {
				deletePartFrame(componentName)
			}
		},
		createFrame: (componentName: string) => {
			const fragmentId = config.componentNameToFragmentId[componentName]
			if (fragmentId !== undefined) {
				createFragmentFrame(fragmentId, componentName)
			} else {
				createPartFrame(componentName)
			}
		},
		save: () => {
			config.save?.()
		},
		discardChanges: () => {
			config.discardChanges?.()
		},
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
	}
}

const useStandalonePartConfig = (partID: () => string): LocalPartConfig => {
	const appClient = useViamClient()
	const viamClient = $derived(appClient.current?.appClient)

	let networkPartConfig = $state.raw<Struct>({} as Struct)
	let current = $state.raw<Struct>({} as Struct)
	let partName = $state<string>()
	let isDirty = $state(false)
	let hasEditPermissions = $state(false)
	let componentNameToFragmentId = $state<Record<string, string>>({})

	$effect.pre(() => {
		const initLocalConfig = async () => {
			const partResponse = await viamClient?.getRobotPart(partID())

			if (JSON.parse(partResponse?.configJson ?? 'null') === null) {
				// no config returned here indicates this api key has no permission to update config
				return
			}
			hasEditPermissions = true

			const configJson = JSON.parse(partResponse?.configJson ?? '{}')
			networkPartConfig = Struct.fromJson(configJson)
			current = Struct.fromJson(configJson)

			partName = partResponse?.part?.name
			componentNameToFragmentId = {}

			const fragmentRequests = []

			if (configJson.fragments) {
				for (const fragmentId of configJson.fragments) {
					//TODO: right now the json could be just a list of strings or an object with an id prop
					const fragId = typeof fragmentId === 'string' ? fragmentId : fragmentId.id
					fragmentRequests.push(viamClient?.getFragment(fragId))
				}

				const fragementResponses = await Promise.all(fragmentRequests)

				for (const fragmentResponse of fragementResponses) {
					const fragmentId = fragmentResponse?.id
					if (!fragmentId) {
						continue
					}
					const components = fragmentResponse?.fragment?.fields['components']?.kind

					if (components?.case === 'listValue') {
						for (const component of components.value.values) {
							if (component.kind.case === 'structValue') {
								const componentName = component.kind.value.fields['name']?.kind
								if (componentName.case === 'stringValue') {
									componentNameToFragmentId[componentName.value] = fragmentId
								}
							}
						}
					}
				}
			}
		}

		initLocalConfig()
	})

	return {
		get current() {
			return current ?? new Struct()
		},
		get isDirty() {
			return isDirty
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
			await viamClient?.updateRobotPart(partID(), partName, current)

			isDirty = false
		},

		discardChanges() {
			if (!networkPartConfig) {
				return
			}

			current = networkPartConfig
			isDirty = false
		},
	}
}
