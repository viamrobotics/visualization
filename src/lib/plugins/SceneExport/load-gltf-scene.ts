import type { Object3D } from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { gltfLoader } from '$lib/loaders/gltf'

/** `traits.GLTF`'s `source`. */
type GltfSource = { url: string } | { gltf: GLTF } | { glb: Uint8Array }

/**
 * The scene of a draw-API GLTF, loaded the way `GLTF.svelte` loads it. The renderer's own copy is not
 * reachable from the ECS, so the export parses its own.
 */
export const loadGltfScene = async (source: GltfSource): Promise<Object3D> => {
	if ('gltf' in source) return source.gltf.scene
	if ('url' in source) {
		const { scene } = await gltfLoader.loadAsync(source.url)
		return scene
	}
	const buffer = source.glb.buffer.slice(
		source.glb.byteOffset,
		source.glb.byteOffset + source.glb.byteLength
	)
	const { scene } = await gltfLoader.parseAsync(buffer as ArrayBuffer, '')
	return scene
}
