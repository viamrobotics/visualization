import type { Object3D } from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { DRACOLoader, GLTFLoader } from 'three/examples/jsm/Addons.js'

const dracoLoader = new DRACOLoader()
const gltfLoader = new GLTFLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
gltfLoader.setDRACOLoader(dracoLoader)

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
