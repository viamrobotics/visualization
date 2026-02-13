import { type Frame, createFrame } from '$lib/frame'
import { createPoseFromFrame } from '$lib/transform'
import { Struct, Pose } from '@viamrobotics/sdk'
import type { JsonValue, ViamClient } from '@viamrobotics/sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('part-config-context')

export interface PartConfig {
	components: { name: string; frame?: Frame }[]
	fragment_mods?: {
		fragment_id: string
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		mods: any[]
	}[]
}

interface PartConfigParams {
	appEmbeddedPartConfigProps?: AppEmbeddedPartConfigProps
	standalonePartConfigProps?: StandalonePartConfigProps
}

interface PartConfigContext {
	updateFrame: (
		componentName: string,
		referenceFrame: string,
		pose: Pose,
		geometry?: Frame['geometry']
	) => void
	saveLocalPartConfig: () => void
	resetLocalPartConfig: () => void
	deleteFrame: (componentName: string) => void
	createFrame: (componentName: string) => void
	componentNameToFragmentId: Record<string, string>
	localPartConfig: Struct
	isDirty: boolean
	hasEditPermissions: boolean
}

export const providePartConfig = (params: () => PartConfigParams) => {
	const { appEmbeddedPartConfigProps, standalonePartConfigProps } = params()
	let _localPartConfig: LocalPartConfig
	if (appEmbeddedPartConfigProps) {
		_localPartConfig = new AppEmbeddedPartConfig(appEmbeddedPartConfigProps)
	} else if (standalonePartConfigProps) {
		_localPartConfig = new StandalonePartConfig(standalonePartConfigProps)
	} else {
		throw new Error('No part config provided')
	}

	const createFragmentFrame = (fragmentId: string, componentName: string) => {
		const newConfig = _localPartConfig.getLocalPartConfig().toJson() as unknown as PartConfig
		if (newConfig.fragment_mods === undefined) {
			newConfig.fragment_mods = []
		}
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
		const configStruct = Struct.fromJson(newConfig as unknown as JsonValue)
		_localPartConfig.setLocalPartConfig(configStruct)
	}

	const createPartFrame = (componentName: string) => {
		const newConfig = _localPartConfig.getLocalPartConfig().toJson() as unknown as PartConfig
		const component = newConfig?.components?.find((comp) => comp.name === componentName)
		if (component) {
			component.frame = createFrame()
		}
		const configStruct = Struct.fromJson(newConfig as unknown as JsonValue)
		_localPartConfig.setLocalPartConfig(configStruct)
	}

	const updateFragmentFrame = (
		fragmentId: string,
		componentName: string,
		referenceFrame: string,
		framePosition: Pose,
		frameGeometry?: Frame['geometry']
	) => {
		const newConfig = _localPartConfig.getLocalPartConfig().toJson() as unknown as PartConfig
		if (newConfig.fragment_mods === undefined) {
			newConfig.fragment_mods = []
		}
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

		_localPartConfig.setLocalPartConfig(Struct.fromJson(newConfig as unknown as JsonValue))
	}

	const updatePartFrame = (
		componentName: string,
		referenceFrame: string,
		pose: Pose,
		geometry?: Frame['geometry']
	) => {
		const newConfig = _localPartConfig.getLocalPartConfig().toJson() as unknown as PartConfig
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

		const configStruct = Struct.fromJson(newConfig as unknown as JsonValue)
		_localPartConfig.setLocalPartConfig(configStruct)
	}

	const deletePartFrame = (componentName: string) => {
		const newConfig = _localPartConfig.getLocalPartConfig().toJson() as unknown as PartConfig
		const component = newConfig?.components?.find(
			(comp: { name: string }) => comp.name === componentName
		)
		if (!component) {
			return
		}
		delete component.frame
		const configStruct = Struct.fromJson(newConfig as unknown as JsonValue)
		_localPartConfig.setLocalPartConfig(configStruct)
	}

	const deleteFragmentFrame = (fragmentId: string, componentName: string) => {
		const newConfig = _localPartConfig.getLocalPartConfig().toJson() as unknown as PartConfig
		if (newConfig.fragment_mods === undefined) {
			newConfig.fragment_mods = []
		}
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
		const configStruct = Struct.fromJson(newConfig as unknown as JsonValue)
		_localPartConfig.setLocalPartConfig(configStruct)
	}

	setContext<PartConfigContext>(key, {
		updateFrame: (
			componentName: string,
			referenceFrame: string,
			framePosition: Pose,
			frameGeometry?: Frame['geometry']
		) => {
			const fragmentId = _localPartConfig.componentNameToFragmentId()[componentName]
			if (fragmentId !== undefined) {
				updateFragmentFrame(fragmentId, componentName, referenceFrame, framePosition, frameGeometry)
			} else {
				updatePartFrame(componentName, referenceFrame, framePosition, frameGeometry)
			}
		},
		deleteFrame: (componentName: string) => {
			const fragmentId = _localPartConfig.componentNameToFragmentId()[componentName]
			if (fragmentId !== undefined) {
				deleteFragmentFrame(fragmentId, componentName)
			} else {
				deletePartFrame(componentName)
			}
		},
		createFrame: (componentName: string) => {
			const fragmentId = _localPartConfig.componentNameToFragmentId()[componentName]
			if (fragmentId !== undefined) {
				createFragmentFrame(fragmentId, componentName)
			} else {
				createPartFrame(componentName)
			}
		},
		saveLocalPartConfig: () => {
			_localPartConfig.saveLocalPartConfig?.()
		},
		resetLocalPartConfig: () => {
			_localPartConfig.resetLocalPartConfig?.()
		},
		get localPartConfig() {
			return _localPartConfig.getLocalPartConfig()
		},
		get componentNameToFragmentId() {
			return _localPartConfig.componentNameToFragmentId()
		},
		get isDirty() {
			return _localPartConfig.isDirty()
		},
		get hasEditPermissions() {
			return _localPartConfig.hasEditPermissions()
		},
	})
}

export const usePartConfig = (): PartConfigContext => {
	return getContext<PartConfigContext>(key)
}

interface LocalPartConfig {
	isDirty: () => boolean
	hasEditPermissions: () => boolean
	getLocalPartConfig: () => Struct
	setLocalPartConfig: (config: Struct) => void
	componentNameToFragmentId: () => Record<string, string>
	saveLocalPartConfig?: () => void
	resetLocalPartConfig?: () => void
}

interface AppEmbeddedPartConfigProps {
	isDirty: () => boolean
	getLocalPartConfig: () => Struct
	setLocalPartConfig: (config: Struct) => void
	getComponentToFragId: () => Record<string, string>
}
class AppEmbeddedPartConfig implements LocalPartConfig {
	private _appEmbeddedPartConfigProps: AppEmbeddedPartConfigProps
	constructor(appEmbeddedPartConfigProps: AppEmbeddedPartConfigProps) {
		this._appEmbeddedPartConfigProps = appEmbeddedPartConfigProps
	}

	public isDirty(): boolean {
		return this._appEmbeddedPartConfigProps.isDirty()
	}

	public getLocalPartConfig(): Struct {
		return this._appEmbeddedPartConfigProps.getLocalPartConfig()
	}

	public setLocalPartConfig(config: Struct): void {
		return this._appEmbeddedPartConfigProps.setLocalPartConfig(config)
	}

	public componentNameToFragmentId(): Record<string, string> {
		return this._appEmbeddedPartConfigProps.getComponentToFragId()
	}

	public hasEditPermissions(): boolean {
		return true
	}
}

interface StandalonePartConfigProps {
	viamClient: () => ViamClient | undefined
	partID: () => string
}
class StandalonePartConfig implements LocalPartConfig {
	private _standalonePartConfigProps: StandalonePartConfigProps
	private _isDirty = $state(false)
	private _hasEditPermissions = $state(false)
	private _networkPartConfig = $state<Struct>()
	private _localPartConfig = $state<Struct>()
	private _partName = $state<string>()
	private _componentNameToFragmentId = $state<Record<string, string>>()

	constructor(standalonePartConfigProps: StandalonePartConfigProps) {
		this._standalonePartConfigProps = standalonePartConfigProps

		$effect.pre(() => {
			const initLocalConfig = async () => {
				const partResponse = await standalonePartConfigProps
					.viamClient()
					?.appClient.getRobotPart(standalonePartConfigProps.partID())
				if (JSON.parse(partResponse?.configJson ?? 'null') === null) {
					// no config returned here indicates this api key has no permission to update config
					return
				}
				this._hasEditPermissions = true
				const configJson = JSON.parse(partResponse?.configJson ?? '{}')
				this._networkPartConfig = Struct.fromJson(configJson)
				this._localPartConfig = Struct.fromJson(configJson)
				this._partName = partResponse?.part?.name

				const componentNameToFragmentId: Record<string, string> = {}
				const fragmentRequests = []

				if (configJson.fragments) {
					for (const fragmentId of configJson.fragments) {
						//TODO: right now the json could be just a list of strings or an object with an id prop
						const fragId = typeof fragmentId === 'string' ? fragmentId : fragmentId.id
						fragmentRequests.push(
							standalonePartConfigProps.viamClient()?.appClient.getFragment(fragId)
						)
					}

					const fragementResponses = await Promise.all(fragmentRequests)

					for (const fragmentResponse of fragementResponses) {
						const fragmentId = fragmentResponse?.id
						if (!fragmentId) {
							continue
						}
						const components = fragmentResponse?.fragment?.fields['components'].kind

						if (components?.case === 'listValue') {
							for (const component of components.value.values) {
								if (component.kind.case === 'structValue') {
									const componentName = component.kind.value.fields['name'].kind
									if (componentName.case === 'stringValue') {
										componentNameToFragmentId[componentName.value] = fragmentId
									}
								}
							}
						}
					}
					this._componentNameToFragmentId = componentNameToFragmentId
				}
			}

			initLocalConfig()
		})
	}

	public getLocalPartConfig(): Struct {
		return this._localPartConfig ?? new Struct()
	}
	public setLocalPartConfig(config: Struct): void {
		this._localPartConfig = config
		this._isDirty = true
	}

	public isDirty(): boolean {
		return this._isDirty
	}

	public hasEditPermissions(): boolean {
		return this._hasEditPermissions
	}

	public componentNameToFragmentId(): Record<string, string> {
		return this._componentNameToFragmentId ?? {}
	}

	public async saveLocalPartConfig(): Promise<void> {
		if (!this._localPartConfig || !this._partName) {
			return
		}
		this._networkPartConfig = this._localPartConfig
		await this._standalonePartConfigProps
			.viamClient()
			?.appClient.updateRobotPart(
				this._standalonePartConfigProps.partID(),
				this._partName,
				this._localPartConfig
			)
		this._isDirty = false
	}

	public async resetLocalPartConfig(): Promise<void> {
		if (!this._networkPartConfig) {
			return
		}
		this._localPartConfig = this._networkPartConfig
		this._isDirty = false
	}
}
