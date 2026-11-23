import type { Snippet } from 'svelte'

import type { CameraPose } from '#lib/hooks/useControls.svelte.js'

export interface ScopedSceneProps {
	/**
	 * The machine part whose frames, geometries, and point clouds the scene renders. Empty or
	 * omitted, the scene renders only its grid, lights, and `children`, and makes no robot query.
	 */
	partID?: string

	/**
	 * The frame the scene focuses on. That frame, every frame under it, and every frame above it
	 * render opaque and in their own colors, so an arm's kinematic links and a gripper mounted on
	 * it stay in focus. Every other collidable geometry still renders, at reduced opacity and with
	 * its color muted. Point clouds and drawn shapes are left as they are.
	 *
	 * A component's bare name, such as `arm-1`, keeps its whole arm in focus, and `<name>_origin`
	 * resolves to the same frame. A name that matches no frame de-emphasizes every geometry. Omit
	 * it, or pass an empty string, and the scene renders as it does without focus.
	 */
	frame?: string

	/** The camera pose the scene starts from. Omit it for the default view. */
	cameraPose?: CameraPose

	/**
	 * Whether keyboard and gamepad shortcuts fire. Off by default, so a scene embedded in a host
	 * page never takes the host's keys.
	 */
	inputBindingsEnabled?: boolean

	/** Three.js children, rendered inside the scene. */
	children?: Snippet

	/** Whether moves, turns, and resizes snap while a transform gizmo is dragged. */
	snapping?: boolean

	/** How often the frame poses are refetched, in milliseconds. */
	poseRefreshRate?: number

	/**
	 * Called with a failure the user needs to know about, such as a config save that did not land.
	 * Omit it and the scene drops those messages.
	 */
	onError?: (message: string) => void
}
