import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

export interface PanelSurface {
	context: CanvasRenderingContext2D
	texture: CanvasTexture
}

/**
 * Creates a canvas of `width` × `height` canvas pixels and a texture that samples it.
 *
 * Create a new surface whenever the panel's layout size changes, instead of
 * resizing the canvas. three's WebGLRenderer allocates a texture's storage once,
 * at the size of its first upload. Later `needsUpdate` uploads only write into
 * that storage, so a resized canvas would never get a matching texture.
 */
export const createPanelSurface = (width: number, height: number): PanelSurface => {
	const canvas = document.createElement('canvas')
	canvas.width = Math.max(1, width)
	canvas.height = Math.max(1, height)

	const context = canvas.getContext('2d')
	if (!context) {
		throw new Error('Canvas panels need a 2D canvas context')
	}

	const texture = new CanvasTexture(canvas)
	texture.colorSpace = SRGBColorSpace
	texture.minFilter = LinearFilter
	texture.generateMipmaps = false

	return { context, texture }
}
