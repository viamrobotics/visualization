import type { ConfigurableTrait, Entity } from 'koota'

export type Spawner = (...traits: ConfigurableTrait[]) => Entity

export interface FileDropperOptions<Extension, Prefix> {
	name: string
	extension: Extension
	prefix: Prefix
	result: string | ArrayBuffer | null | undefined
	spawn: Spawner
}

export type FileDropper<
	Extension extends string = string,
	Prefix extends string | undefined = undefined,
> = (options: FileDropperOptions<Extension, Prefix>) => Promise<string | undefined>
