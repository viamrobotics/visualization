import type { PointsGeometry, ThreeBufferGeometry, WorldObject } from '$lib/WorldObject.svelte'

export interface FileDropperHandlers {
	addPoints: (points: WorldObject<PointsGeometry>) => void
	addMesh: (mesh: WorldObject<ThreeBufferGeometry>) => void
}

export interface FileDropperOptions<Extension, Prefix> {
	name: string
	extension: Extension
	prefix: Prefix
	result: string | ArrayBuffer | null | undefined
	handlers?: FileDropperHandlers
}

export type FileDropper<
	Extension extends string = string,
	Prefix extends string | undefined = undefined,
> = (options: FileDropperOptions<Extension, Prefix>) => Promise<string | undefined>
