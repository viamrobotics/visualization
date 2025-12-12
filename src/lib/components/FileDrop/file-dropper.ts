import type { World } from 'koota'

export interface FileDropperOptions<Extension, Prefix> {
	name: string
	extension: Extension
	prefix: Prefix
	result: string | ArrayBuffer | null | undefined
	spawn: World['spawn']
}

export type FileDropper<
	Extension extends string = string,
	Prefix extends string | undefined = undefined,
> = (options: FileDropperOptions<Extension, Prefix>) => Promise<string | undefined>
