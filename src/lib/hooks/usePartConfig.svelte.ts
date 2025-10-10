import { Struct, Pose } from '@viamrobotics/sdk'
import type { JsonValue, ViamClient } from '@viamrobotics/sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('part-config-context')

export interface PartConfigComponents {
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
}

interface PartConfigParams {
	appEmbeddedPartConfigProps?: AppEmbeddedPartConfigProps
	standalonePartConfigProps?: StandalonePartConfigProps
}

export enum LocalPartConfigState {
	dirty = 'DIRTY',
	clean = 'CLEAN',
	discarded = 'DISCARDED',
	saved = 'SAVED',
}

interface PartConfigContext {
	setFrameParentConfig: (componentName: string, parentName: string) => void
	updateFrame: (
		componentName: string,
		pose: Pose,
		geometry?: {
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
	localPartConfig: Struct
	localPartConfigState: LocalPartConfigState
}

export const providePartConfig = (params: PartConfigParams) => {
	const { appEmbeddedPartConfigProps, standalonePartConfigProps } = params
	let _localPartConfig: LocalPartConfig
	if (appEmbeddedPartConfigProps) {
		_localPartConfig = new AppEmbeddedPartConfig(appEmbeddedPartConfigProps)
	} else if (standalonePartConfigProps) {
		_localPartConfig = new StandalonePartConfig(standalonePartConfigProps)
	} else {
		throw new Error('No part config provided')
	}

	const setFrameParentConfig = async (componentName: string, parentName: string) => {
		const newConfig = _localPartConfig
			.getLocalPartConfig()
			.toJson() as unknown as PartConfigComponents
		const component = newConfig?.components?.find(
			(comp: { name: string }) => comp.name === componentName
		)
		if (!component) {
			return
		}
		component.frame.parent = parentName

		const partName = _localPartConfig.partName()
		if (partName !== undefined) {
			const configStruct = Struct.fromJson(newConfig as unknown as JsonValue)
			_localPartConfig.setLocalPartConfig(configStruct)
		}
	}

	const updateFrame = async (
		componentName: string,
		pose: Pose,
		geometry?: {
			type: 'none' | 'box' | 'sphere' | 'capsule'
			r?: number
			l?: number
			x?: number
			y?: number
			z?: number
		}
	) => {
		const newConfig = _localPartConfig
			.getLocalPartConfig()
			.toJson() as unknown as PartConfigComponents
		const component = newConfig?.components?.find(
			(comp: { name: string }) => comp.name === componentName
		)
		if (!component) {
			return
		}
		if (component && component.frame) {
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

		const partName = _localPartConfig.partName()
		if (partName !== undefined) {
			const configStruct = Struct.fromJson(newConfig as unknown as JsonValue)
			_localPartConfig.setLocalPartConfig(configStruct)
		}
	}

	const saveLocalPartConfig = () => {
		_localPartConfig.saveLocalPartConfig?.()
	}

	const resetLocalPartConfig = () => {
		_localPartConfig.resetLocalPartConfig?.()
	}

	setContext<PartConfigContext>(key, {
		setFrameParentConfig,
		updateFrame,
		saveLocalPartConfig,
		resetLocalPartConfig,
		get localPartConfig() {
			return _localPartConfig.getLocalPartConfig()
		},
		get localPartConfigState() {
			return _localPartConfig.getLocalPartConfigState()
		},
	})
}

export const usePartConfig = (): PartConfigContext => {
	return getContext<PartConfigContext>(key)
}

interface LocalPartConfig {
	getLocalPartConfigState: () => LocalPartConfigState
	getLocalPartConfig: () => Struct
	setLocalPartConfig: (config: Struct) => void
	partName: () => string | undefined
	saveLocalPartConfig?: () => void
	resetLocalPartConfig?: () => void
}

interface AppEmbeddedPartConfigProps {
	getLocalPartConfigState: () => LocalPartConfigState
	getLocalPartConfig: () => Struct
	setLocalPartConfig: (config: Struct) => void
	partName: () => string | undefined
}
export class AppEmbeddedPartConfig implements LocalPartConfig {
	private _appEmbeddedPartConfigProps: AppEmbeddedPartConfigProps
	constructor(appEmbeddedPartConfigProps: AppEmbeddedPartConfigProps) {
		this._appEmbeddedPartConfigProps = appEmbeddedPartConfigProps
	}

	public getLocalPartConfigState(): LocalPartConfigState {
		return this._appEmbeddedPartConfigProps.getLocalPartConfigState()
	}

	public getLocalPartConfig(): Struct {
		return this._appEmbeddedPartConfigProps.getLocalPartConfig()
	}

	public setLocalPartConfig(config: Struct): void {
		return this._appEmbeddedPartConfigProps.setLocalPartConfig(config)
	}

	public partName(): string | undefined {
		return this._appEmbeddedPartConfigProps.partName()
	}
}

interface StandalonePartConfigProps {
	viamClient: () => ViamClient | undefined
	partID: string
}
export class StandalonePartConfig implements LocalPartConfig {
	private _standalonePartConfigProps: StandalonePartConfigProps
	private _localPartConfigState = $state(LocalPartConfigState.clean)
	private _networkPartConfig = $state<Struct>()
	private _localPartConfig = $state<Struct>()
	private _partName = $state<string>()

	constructor(standalonePartConfigProps: StandalonePartConfigProps) {
		this._standalonePartConfigProps = standalonePartConfigProps

		$effect.pre(() => {
			const initLocalConfig = async () => {
				const partResponse = await standalonePartConfigProps
					.viamClient()
					?.appClient.getRobotPart(standalonePartConfigProps.partID)
				this._networkPartConfig = Struct.fromJson(JSON.parse(partResponse?.configJson ?? '{}'))
				this._localPartConfig = Struct.fromJson(JSON.parse(partResponse?.configJson ?? '{}'))
				this._partName = partResponse?.part?.name
			}

			initLocalConfig()
		})
	}

	public getLocalPartConfig(): Struct {
		return this._localPartConfig ?? new Struct()
	}
	public setLocalPartConfig(config: Struct): void {
		this._localPartConfig = config
		this._localPartConfigState = LocalPartConfigState.dirty
	}

	public partName(): string | undefined {
		return this._partName
	}

	public getLocalPartConfigState(): LocalPartConfigState {
		return this._localPartConfigState
	}

	public async saveLocalPartConfig(): Promise<void> {
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
		this._localPartConfigState = LocalPartConfigState.saved
	}

	public async resetLocalPartConfig(): Promise<void> {
		if (!this._networkPartConfig) {
			return
		}
		this._localPartConfig = this._networkPartConfig
		this._localPartConfigState = LocalPartConfigState.discarded
	}
}
