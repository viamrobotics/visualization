import type { PointsGeometry, ThreeBufferGeometry, WorldObject } from '$lib/WorldObject.svelte'

export const isString = (result: string | ArrayBuffer | null | undefined): result is string => {
	return result !== null && result !== undefined && typeof result === 'string'
}

export const isArrayBuffer = (
	result: string | ArrayBuffer | null | undefined
): result is ArrayBuffer => {
	return result !== null && result !== undefined && typeof result !== 'string'
}

export const isPCD = (
	worldObject: WorldObject<PointsGeometry> | WorldObject<ThreeBufferGeometry>
): worldObject is WorldObject<PointsGeometry> => {
	return worldObject.geometry?.geometryType?.case === 'points'
}

export const isMesh = (
	worldObject: WorldObject<PointsGeometry> | WorldObject<ThreeBufferGeometry>
): worldObject is WorldObject<ThreeBufferGeometry> => {
	return worldObject.geometry?.geometryType?.case === 'bufferGeometry'
}
