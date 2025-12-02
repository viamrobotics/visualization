import type { BufferGeometry } from 'three'
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js'

const plyLoader = new PLYLoader()

export const parsePlyInput = (mesh: string | Uint8Array): BufferGeometry => {
	// Case 1: already a base64 or ASCII string
	if (typeof mesh === 'string') {
		return plyLoader.parse(atob(mesh))
	}

	// Case 2: detect text vs binary PLY in Uint8Array
	const header = new TextDecoder().decode(mesh.slice(0, 50))
	const isAscii = header.includes('format ascii')

	// Case 3: text-mode PLY → decode bytes to string
	if (isAscii) {
		const text = new TextDecoder().decode(mesh)
		return plyLoader.parse(text)
	}

	// Case 4: binary PLY → pass ArrayBuffer directly
	return plyLoader.parse(mesh.buffer as ArrayBuffer)
}
