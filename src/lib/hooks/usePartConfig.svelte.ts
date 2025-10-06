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
}

export const providePartConfig = (params: PartConfigParams) => {
    const { appEmbeddedPartConfigProps, standalonePartConfigProps } = params;
	let localPartConfig: LocalPartConfig;
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
		localPartConfig.saveLocalPartConfig?.()
	}

	const resetLocalPartConfig = () => {
		localPartConfig.resetLocalPartConfig?.()
	}

	const getLocalPartConfig = () => {
		return localPartConfig.getLocalPartConfig()
	}

    setContext<PartConfigContext>(key, {
        setFrameParentConfig,
        updateFrame,
		isDirty,
		saveLocalPartConfig,
		resetLocalPartConfig,
		getLocalPartConfig,
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
	private appEmbeddedPartConfigProps: AppEmbeddedPartConfigProps
	constructor(appEmbeddedPartConfigProps: AppEmbeddedPartConfigProps) {
		this.appEmbeddedPartConfigProps = appEmbeddedPartConfigProps
	}

	public isDirty(): boolean {
		return this.appEmbeddedPartConfigProps.isDirty()
	}

	public getLocalPartConfig(): unknown {
		return this.appEmbeddedPartConfigProps.getLocalPartConfig()
	}

	public setLocalPartConfig(config: Struct, partName: string): void {
		return this.appEmbeddedPartConfigProps.setLocalPartConfig(config, partName)
	}

	public partName(): string | undefined {
		return this.appEmbeddedPartConfigProps.partName()
	}
}

interface StandalonePartConfigProps {
	viamClient: () => ViamClient | undefined
	partID: string
	partName: () => string | undefined
}
export class StandalonePartConfig implements LocalPartConfig {
	private standalonePartConfigProps: StandalonePartConfigProps
	private dirty = $state(false);
	private networkPartConfig = $state<Struct>();
	private localPartConfig = $state<Struct>();

	constructor(standalonePartConfigProps: StandalonePartConfigProps) {
		this.standalonePartConfigProps = standalonePartConfigProps

		$effect.pre(() => {
			const self = this
			async function initLocalConfig() {
				const partResponse = await standalonePartConfigProps.viamClient()?.appClient.getRobotPart(standalonePartConfigProps.partID)
				self.networkPartConfig = Struct.fromJson(JSON.parse(partResponse?.configJson ?? '{}'))
				self.localPartConfig = Struct.fromJson(JSON.parse(partResponse?.configJson ?? '{}'))
			}

			initLocalConfig()
		})
	}
	

	public getLocalPartConfig(): unknown {
		return this.localPartConfig?.toJson() ?? {}
	}
	public setLocalPartConfig(config: Struct, _: string): void {
		this.localPartConfig = config
		this.dirty = true
	}

	public partName(): string | undefined {
		return this.standalonePartConfigProps.partName()
	}

	public isDirty(): boolean {
		return this.dirty
	}

	public async saveLocalPartConfig(): Promise<void> {
		if (!this.localPartConfig) {
			return
		}
		await this.standalonePartConfigProps.viamClient()?.appClient.updateRobotPart(this.standalonePartConfigProps.partID, this.standalonePartConfigProps.partName() ?? '', this.localPartConfig)
		this.dirty = false
	}

	public async resetLocalPartConfig(): Promise<void> {
		if (!this.networkPartConfig) {
			return
		}
		this.localPartConfig = this.networkPartConfig
		this.dirty = false
	}
}



