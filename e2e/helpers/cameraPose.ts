import type { Page } from '@playwright/test'

export interface CameraPose {
	/** Camera position in metres, rounded to millimetre precision. */
	position: number[]
	/** The point the camera orbits, in metres. */
	target: number[]
}

/**
 * Reads the live camera pose out of the page.
 *
 * `camera-controls` writes its target into a `Vector3` the caller supplies, and
 * Three is not on the page as a global, so the out vector is cloned from the
 * camera's own position rather than constructed.
 */
export const readCameraPose = (page: Page): Promise<CameraPose | undefined> =>
	page.evaluate(() => {
		interface Vec3 {
			x: number
			y: number
			z: number
			clone: () => Vec3
		}
		const controls = (
			globalThis as unknown as {
				cameraControls?: { camera: { position: Vec3 }; getTarget: (out: Vec3) => Vec3 }
			}
		).cameraControls

		if (!controls) return undefined

		const round = (value: number) => Math.round(value * 1e3) / 1e3 || 0
		const { position } = controls.camera
		const target = controls.getTarget(position.clone())

		return {
			position: [round(position.x), round(position.y), round(position.z)],
			target: [round(target.x), round(target.y), round(target.z)],
		}
	})
