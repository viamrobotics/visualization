import { type BufferGeometry, Mesh } from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'

const exporter = new STLExporter()

/** `geometry` as binary STL, in metres, which every target sim reads as-is. */
export const meshToStl = (geometry: BufferGeometry): Uint8Array => {
	const view = exporter.parse(new Mesh(geometry), { binary: true })
	return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
}
