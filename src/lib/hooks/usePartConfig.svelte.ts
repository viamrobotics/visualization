import { Struct, Pose } from '@viamrobotics/sdk'
import type { JsonValue, ViamClient } from '@viamrobotics/sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('part-config-context')

export interface PartConfig {
	components: {
		name: string
		frame: {
			parent: string
			translation: {
				x: number
				y: number
				z: number
			}
			orientation: {
				value: {
					x: number
					y: number
					z: number
					th: number
				}
			}
			geometry?: {
				type: 'none' | 'box' | 'sphere' | 'capsule'
				x?: number
				y?: number
				z?: number
				r?: number
				l?: number
			}
		}
	}[]
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
<<<<<<< HEAD
		pose: Pose,
		geometry?: {
=======
		framePosition: {
			x: number
			y: number
			z: number
			oX: number
			oY: number
			oZ: number
			theta: number
		},
		frameGeometry?: {
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
			type: 'none' | 'box' | 'sphere' | 'capsule'
			r?: number
			l?: number
			x?: number
			y?: number
			z?: number
		}
	) => void
	saveLocalPartConfig: () => void
	resetLocalPartConfig: () => void
<<<<<<< HEAD
	componentNameToFragmentId: Record<string, string>
	localPartConfig: Struct
	isDirty: boolean
=======
	getLocalPartConfig: () => unknown
	getComponentNameToFragmentId: () => Record<string, string>
	getAwaitingRefresh: () => boolean
	setAwaitingRefresh: (awaitingRefresh: boolean) => void
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
}

export const providePartConfig = (params: PartConfigParams) => {
	const { appEmbeddedPartConfigProps, standalonePartConfigProps } = params
<<<<<<< HEAD
	let _localPartConfig: LocalPartConfig
=======
	let localPartConfig: LocalPartConfig
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
	if (appEmbeddedPartConfigProps) {
		_localPartConfig = new AppEmbeddedPartConfig(appEmbeddedPartConfigProps)
	} else if (standalonePartConfigProps) {
		_localPartConfig = new StandalonePartConfig(standalonePartConfigProps)
	} else {
		throw new Error('No part config provided')
	}

<<<<<<< HEAD
=======
	let awaitingRefresh = $state(false)

>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
	const updateFrame = (
		componentName: string,
		referenceFrame: string,
		framePosition: {
			x: number
			y: number
			z: number
			oX: number
			oY: number
			oZ: number
			theta: number
		},
		frameGeometry?: {
			type: 'none' | 'box' | 'sphere' | 'capsule'
			r?: number
			l?: number
			x?: number
			y?: number
			z?: number
		}
	) => {
<<<<<<< HEAD
		const fragmentId = _localPartConfig.componentNameToFragmentId()[componentName]
=======
		const fragmentId = localPartConfig.componentNameToFragmentId()[componentName]
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
		if (fragmentId !== undefined) {
			updateFragmentFrame(fragmentId, componentName, referenceFrame, framePosition, frameGeometry)
		} else {
			updatePartFrame(componentName, referenceFrame, framePosition, frameGeometry)
		}
	}

	const updateFragmentFrame = (
		fragmentId: string,
		componentName: string,
		referenceFrame: string,
		framePosition: {
			x: number
			y: number
			z: number
			oX: number
			oY: number
			oZ: number
			theta: number
		},
		frameGeometry?: {
			type: 'none' | 'box' | 'sphere' | 'capsule'
			r?: number
			l?: number
			x?: number
			y?: number
			z?: number
		}
	) => {
<<<<<<< HEAD
		const newConfig = _localPartConfig.getLocalPartConfig().toJson() as unknown as PartConfig
=======
		const newConfig = localPartConfig.getLocalPartConfig() as PartConfig
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
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

<<<<<<< HEAD
		_localPartConfig.setLocalPartConfig(Struct.fromJson(newConfig as unknown as JsonValue))
=======
		localPartConfig.setLocalPartConfig(Struct.fromJson(newConfig as unknown as JsonValue))
		awaitingRefresh = true
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
	}

	const updatePartFrame = (
		componentName: string,
		referenceFrame: string,
<<<<<<< HEAD
		pose: Pose,
		geometry?: {
=======
		framePosition: {
			x: number
			y: number
			z: number
			oX: number
			oY: number
			oZ: number
			theta: number
		},
		frameGeometry?: {
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
			type: 'none' | 'box' | 'sphere' | 'capsule'
			r?: number
			l?: number
			x?: number
			y?: number
			z?: number
		}
	) => {
<<<<<<< HEAD
		const newConfig = _localPartConfig.getLocalPartConfig().toJson() as unknown as PartConfig
=======
		const newConfig = localPartConfig.getLocalPartConfig() as PartConfig
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
		const component = newConfig?.components?.find(
			(comp: { name: string }) => comp.name === componentName
		)
		if (!component) {
			return
		}
		if (component && component.frame) {
			component.frame.parent = referenceFrame
			component.frame.translation = {
				x: pose.x === undefined ? component.frame.translation.x : pose.x,
				y: pose.y === undefined ? component.frame.translation.y : pose.y,
				z: pose.z === undefined ? component.frame.translation.z : pose.z,
			}
			component.frame.orientation.value = {
				x: pose.oX === undefined ? component.frame.orientation.value.x : pose.oX,
				y: pose.oY === undefined ? component.frame.orientation.value.y : pose.oY,
				z: pose.oZ === undefined ? component.frame.orientation.value.z : pose.oZ,
				th: pose.theta === undefined ? component.frame.orientation.value.th : pose.theta,
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
<<<<<<< HEAD
		_localPartConfig.setLocalPartConfig(configStruct)
=======
		localPartConfig.setLocalPartConfig(configStruct)
		awaitingRefresh = true
	}

	const isDirty = () => {
		return localPartConfig.isDirty()
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
	}

	const saveLocalPartConfig = () => {
		_localPartConfig.saveLocalPartConfig?.()
	}

	const resetLocalPartConfig = () => {
		_localPartConfig.resetLocalPartConfig?.()
	}

	const getComponentNameToFragmentId = () => {
		return localPartConfig.componentNameToFragmentId()
	}

	setContext<PartConfigContext>(key, {
		updateFrame,
		saveLocalPartConfig,
		resetLocalPartConfig,
<<<<<<< HEAD
		get localPartConfig() {
			return _localPartConfig.getLocalPartConfig()
		},
		get componentNameToFragmentId() {
			return _localPartConfig.componentNameToFragmentId()
		},
		get isDirty() {
			return _localPartConfig.isDirty()
		},
=======
		getLocalPartConfig,
		getComponentNameToFragmentId,
		getAwaitingRefresh,
		setAwaitingRefresh,
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
	})
}

export const usePartConfig = (): PartConfigContext => {
	return getContext<PartConfigContext>(key)
}

interface LocalPartConfig {
	isDirty: () => boolean
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
<<<<<<< HEAD
	getComponentToFragId: () => Record<string, string>
=======
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
}
export class AppEmbeddedPartConfig implements LocalPartConfig {
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
<<<<<<< HEAD
		return this._appEmbeddedPartConfigProps.getComponentToFragId()
=======
		// TODO: get this from app client somehow
		return {}
>>>>>>> 1e5b46a (add ability to modify fragment frames (local motion-tools))
	}
}

interface StandalonePartConfigProps {
	viamClient: () => ViamClient | undefined
	partID: () => string
}
export class StandalonePartConfig implements LocalPartConfig {
	private _standalonePartConfigProps: StandalonePartConfigProps
	private _isDirty = $state(false)
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
				const configJson = JSON.parse(partResponse?.configJson ?? '{}')
				this._networkPartConfig = Struct.fromJson(configJson)
				this._localPartConfig = Struct.fromJson(configJson)
				this._partName = partResponse?.part?.name

				const componentNameToFragmentId: Record<string, string> = {}
				const fragementRequests = []

				if (configJson.fragments) {
					for (const fragmentId of configJson.fragments) {
						fragementRequests.push(
							standalonePartConfigProps.viamClient()?.appClient.getFragment(fragmentId)
						)
					}
					const fragementResponses = await Promise.all(fragementRequests)
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
