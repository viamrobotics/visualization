import { Struct } from "@viamrobotics/sdk"
import type { ViamClient } from "@viamrobotics/sdk"
import { getContext, setContext } from "svelte"

const key = Symbol("part-config-context")

interface PartConfigParams {
    appEmbeddedPartConfigProps?: AppEmbeddedPartConfigProps
    standalonePartConfigProps?: StandalonePartConfigProps
}

interface PartConfigContext {
    setFrameParentConfig: (componentName: string, parentName: string) => void
    updateFrame: (componentName: string, framePosition: {x: number, y: number, z: number, oX: number, oY: number, oZ: number, theta: number}, frameGeometry?: {type: 'none' | 'box' | 'sphere' | 'capsule', r?: number, l?: number, x?: number, y?: number, z?: number}) => void
    isDirty: () => boolean
    saveLocalPartConfig: () => void
    resetLocalPartConfig: () => void
	getLocalPartConfig: () => unknown
	getAwaitingRefresh: () => boolean
	setAwaitingRefresh: (awaitingRefresh: boolean) => void
}

export const providePartConfig = (params: PartConfigParams) => {
    const { appEmbeddedPartConfigProps, standalonePartConfigProps } = params;
	let localPartConfig: LocalPartConfig;
	let awaitingRefresh = $state(false);
	if (appEmbeddedPartConfigProps) {
		localPartConfig = new AppEmbeddedPartConfig(appEmbeddedPartConfigProps)
	} else if (standalonePartConfigProps) {
		localPartConfig = new StandalonePartConfig(standalonePartConfigProps)
	} else {
		throw new Error("No part config provided")
	}
	
    const setFrameParentConfig = async (componentName: string, parentName: string) => {
		const newConfig = localPartConfig.getLocalPartConfig() as any;
		const component = newConfig?.components?.find((comp: any) => comp.name === componentName)
		component.frame.parent = parentName

		const partName = localPartConfig.partName();
		if (partName !== undefined) {
			const configStruct = Struct.fromJson(newConfig);
			localPartConfig.setLocalPartConfig(configStruct, partName);
		}
	}

    const updateFrame = async (componentName: string, framePosition: {x: number, y: number, z: number, oX: number, oY: number, oZ: number, theta: number}, frameGeometry?: {type: 'none' | 'box' | 'sphere' | 'capsule', r?: number, l?: number, x?: number, y?: number, z?: number}) => {
		const newConfig = localPartConfig.getLocalPartConfig() as any;
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

		const partName = localPartConfig.partName();
		if (partName !== undefined) {
			const configStruct = Struct.fromJson(newConfig);
			localPartConfig.setLocalPartConfig(configStruct, partName);
		}
    }

	const isDirty = () => {
		return localPartConfig.isDirty()
	}

	const saveLocalPartConfig = () => {
		awaitingRefresh = true
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

    setContext<PartConfigContext>(key, {
        setFrameParentConfig,
        updateFrame,
		isDirty,
		saveLocalPartConfig,
		resetLocalPartConfig,
		getLocalPartConfig,
		getAwaitingRefresh,
		setAwaitingRefresh
    })
}

export const usePartConfig = (): PartConfigContext => {
    return getContext<PartConfigContext>(key)
}

interface LocalPartConfig {
	isDirty: () => boolean
	getLocalPartConfig: () => unknown
	setLocalPartConfig: (config: Struct, partName: string) => void
	partName: () => string | undefined
	saveLocalPartConfig?: () => void
	resetLocalPartConfig?: () => void
}


interface AppEmbeddedPartConfigProps {
	isDirty: () => boolean
	getLocalPartConfig: () => unknown
	setLocalPartConfig: (config: Struct, partName: string) => void
	partName: () => string | undefined
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

	public setLocalPartConfig(config: Struct, partName: string): void {
		return this._appEmbeddedPartConfigProps.setLocalPartConfig(config, partName)
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
	private _dirty = $state(false);
	private _networkPartConfig = $state<Struct>();
	private _localPartConfig = $state<Struct>();
	private _partName = $state<string>();

	constructor(standalonePartConfigProps: StandalonePartConfigProps) {
		this._standalonePartConfigProps = standalonePartConfigProps

		$effect.pre(() => {
			const self = this
			async function initLocalConfig() {
				const partResponse = await standalonePartConfigProps.viamClient()?.appClient.getRobotPart(standalonePartConfigProps.partID)
				self._networkPartConfig = Struct.fromJson(JSON.parse(partResponse?.configJson ?? '{}'))
				self._localPartConfig = Struct.fromJson(JSON.parse(partResponse?.configJson ?? '{}'))
				self._partName = partResponse?.part?.name
			}

			initLocalConfig()
		})
	}
	

	public getLocalPartConfig(): unknown {
		return this._localPartConfig?.toJson() ?? {}
	}
	public setLocalPartConfig(config: Struct, _: string): void {
		this._localPartConfig = config
		this._dirty = true
	}

	public partName(): string | undefined {
		return this._partName
	}

	public isDirty(): boolean {
		return this._dirty
	}

	public async saveLocalPartConfig(): Promise<void> {
		if (!this._localPartConfig || !this._partName) {
			return
		}
		this._networkPartConfig = this._localPartConfig
		await this._standalonePartConfigProps.viamClient()?.appClient.updateRobotPart(this._standalonePartConfigProps.partID, this._partName, this._localPartConfig)
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



