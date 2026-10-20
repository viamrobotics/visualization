import {
	type MaterialParameters,
	MeshBasicMaterial,
	MeshStandardMaterial,
	MeshToonMaterial,
} from 'three'

/** Every shading style the scene offers, in the order the settings panel lists them. */
export const RENDER_MODES = ['wireframe', 'toon', 'realistic'] as const

export type RenderMode = (typeof RENDER_MODES)[number]

export type SurfaceMaterial = MeshBasicMaterial | MeshStandardMaterial | MeshToonMaterial

/**
 * Matte plastic. Rough enough that the studio environment map reads as a broad
 * highlight rather than a mirror, and matched to the finish `use3DModels` gives
 * the CAD models so a collider and the model it wraps sit in the same scene.
 */
const REALISTIC_METALNESS = 0.1
const REALISTIC_ROUGHNESS = 0.4

/**
 * Builds the face material for `mode`. Every entity renderer goes through here, so
 * a mode switch cannot leave one shape type shaded differently from the rest.
 *
 * `parameters` covers only what the caller owns per shape — `side`, `transparent`.
 * Color, opacity, and vertex colors are written per entity or per instance after.
 */
export const createSurfaceMaterial = (
	mode: RenderMode,
	parameters: MaterialParameters
): SurfaceMaterial => {
	switch (mode) {
		case 'realistic': {
			return new MeshStandardMaterial({
				...parameters,
				metalness: REALISTIC_METALNESS,
				roughness: REALISTIC_ROUGHNESS,
			})
		}
		case 'toon': {
			return new MeshToonMaterial(parameters)
		}
		case 'wireframe': {
			return new MeshBasicMaterial({ ...parameters, wireframe: true })
		}
	}
}
