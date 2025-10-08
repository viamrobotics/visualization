import { Struct } from '@viamrobotics/sdk'
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
	) => void
	isDirty: () => boolean
	saveLocalPartConfig: () => void
	resetLocalPartConfig: () => void
	getLocalPartConfig: () => unknown
	getComponentNameToFragmentId: () => Record<string, string>
	getAwaitingRefresh: () => boolean
	setAwaitingRefresh: (awaitingRefresh: boolean) => void
}

export const providePartConfig = (params: PartConfigParams) => {
	const { appEmbeddedPartConfigProps, standalonePartConfigProps } = params
	let localPartConfig: LocalPartConfig
	if (appEmbeddedPartConfigProps) {
		localPartConfig = new AppEmbeddedPartConfig(appEmbeddedPartConfigProps)
	} else if (standalonePartConfigProps) {
		localPartConfig = new StandalonePartConfig(standalonePartConfigProps)
	} else {
		throw new Error('No part config provided')
	}

	let awaitingRefresh = $state(false)

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
		const fragmentId = localPartConfig.componentNameToFragmentId()[componentName]
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
		const newConfig = localPartConfig.getLocalPartConfig() as PartConfig
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
			if (existingGeometry) {
				frame['$set'][modSetPath].geometry = existingGeometry
			}
			fragmentMod.mods[existingFrameIndex] = frame
		} else {
			fragmentMod.mods.push(frame)
		}

		localPartConfig.setLocalPartConfig(Struct.fromJson(newConfig as unknown as JsonValue))
		awaitingRefresh = true
	}

	const updatePartFrame = (
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
		const newConfig = localPartConfig.getLocalPartConfig() as PartConfig
		const component = newConfig?.components?.find(
			(comp: { name: string }) => comp.name === componentName
		)
		if (!component) {
			return
		}
		if (component && component.frame) {
			component.frame.parent = referenceFrame
			component.frame.translation = {
				x: framePosition.x === undefined ? component.frame.translation.x : framePosition.x,
				y: framePosition.y === undefined ? component.frame.translation.y : framePosition.y,
				z: framePosition.z === undefined ? component.frame.translation.z : framePosition.z,
			}
			component.frame.orientation.value = {
				x: framePosition.oX === undefined ? component.frame.orientation.value.x : framePosition.oX,
				y: framePosition.oY === undefined ? component.frame.orientation.value.y : framePosition.oY,
				z: framePosition.oZ === undefined ? component.frame.orientation.value.z : framePosition.oZ,
				th:
					framePosition.theta === undefined
						? component.frame.orientation.value.th
						: framePosition.theta,
			}
			if (frameGeometry) {
				if (frameGeometry.type === 'none') {
					delete component.frame.geometry
				} else {
					component.frame.geometry = { ...frameGeometry }
				}
			}
		}

		const configStruct = Struct.fromJson(newConfig as unknown as JsonValue)
		localPartConfig.setLocalPartConfig(configStruct)
		awaitingRefresh = true
	}

	const isDirty = () => {
		return localPartConfig.isDirty()
	}

	const saveLocalPartConfig = () => {
		localPartConfig.saveLocalPartConfig?.()
	}

	const resetLocalPartConfig = () => {
		localPartConfig.resetLocalPartConfig?.()
	}

	const getLocalPartConfig = () => {
		return localPartConfig.getLocalPartConfig()
	}

	const getAwaitingRefresh = () => {
		return awaitingRefresh
	}

	const setAwaitingRefresh = (val: boolean) => {
		awaitingRefresh = val
	}

	const getComponentNameToFragmentId = () => {
		return localPartConfig.componentNameToFragmentId()
	}

	setContext<PartConfigContext>(key, {
		updateFrame,
		isDirty,
		saveLocalPartConfig,
		resetLocalPartConfig,
		getLocalPartConfig,
		getComponentNameToFragmentId,
		getAwaitingRefresh,
		setAwaitingRefresh,
	})
}

export const usePartConfig = (): PartConfigContext => {
	return getContext<PartConfigContext>(key)
}

interface LocalPartConfig {
	isDirty: () => boolean
	getLocalPartConfig: () => unknown
	setLocalPartConfig: (config: Struct) => void
	componentNameToFragmentId: () => Record<string, string>
	saveLocalPartConfig?: () => void
	resetLocalPartConfig?: () => void
}

interface AppEmbeddedPartConfigProps {
	isDirty: () => boolean
	getLocalPartConfig: () => unknown
	setLocalPartConfig: (config: Struct) => void
}
export class AppEmbeddedPartConfig implements LocalPartConfig {
	private _appEmbeddedPartConfigProps: AppEmbeddedPartConfigProps
	constructor(appEmbeddedPartConfigProps: AppEmbeddedPartConfigProps) {
		this._appEmbeddedPartConfigProps = appEmbeddedPartConfigProps
	}

	public isDirty(): boolean {
		return this._appEmbeddedPartConfigProps.isDirty()
	}

	public getLocalPartConfig(): unknown {
		return this._appEmbeddedPartConfigProps.getLocalPartConfig()
	}

	public setLocalPartConfig(config: Struct): void {
		return this._appEmbeddedPartConfigProps.setLocalPartConfig(config)
	}

	public componentNameToFragmentId(): Record<string, string> {
		// TODO: get this from app client somehow
		return {}
	}
}

interface StandalonePartConfigProps {
	viamClient: () => ViamClient | undefined
	partID: string
}
export class StandalonePartConfig implements LocalPartConfig {
	private _standalonePartConfigProps: StandalonePartConfigProps
	private _dirty = $state(false)
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
					?.appClient.getRobotPart(standalonePartConfigProps.partID)
				const configJson = JSON.parse(partResponse?.configJson ?? '{}')
				this._networkPartConfig = Struct.fromJson(configJson)
				this._localPartConfig = Struct.fromJson(configJson)
				this._partName = partResponse?.part?.name

				const componentNameToFragmentId: Record<string, string> = {}
				const fragementRequests = []

				console.log('configJson', configJson)
				if (configJson.fragments) {
					console.log('configJson.fragments', configJson.fragments)
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

	public getLocalPartConfig(): unknown {
		return this._localPartConfig?.toJson() ?? {}
	}
	public setLocalPartConfig(config: Struct): void {
		this._localPartConfig = config
		this._dirty = true
	}

	public isDirty(): boolean {
		return this._dirty
	}

	public componentNameToFragmentId(): Record<string, string> {
		return this._componentNameToFragmentId ?? {}
	}

	public async saveLocalPartConfig(): Promise<void> {
		console.log('saveLocalPartConfig', this._localPartConfig, this._partName)
		if (!this._localPartConfig || !this._partName) {
			return
		}
		this._networkPartConfig = this._localPartConfig
		await this._standalonePartConfigProps
			.viamClient()
			?.appClient.updateRobotPart(
				this._standalonePartConfigProps.partID,
				this._partName,
				this._localPartConfig
			)
		this._dirty = false
	}

	public async resetLocalPartConfig(): Promise<void> {
		if (!this._networkPartConfig) {
			return
		}
		this._localPartConfig = this._networkPartConfig
		this._dirty = false
	}
}
