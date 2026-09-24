let armedFrame = $state<string | undefined>(undefined)

/**
 * The single frame whose move gizmo is live. Several move panels can be open at
 * once, but only one gizmo may own the scene at a time — two draggable handles
 * competing for the same pointer, each staging its own target, is unusable. The
 * most recently armed panel wins and the others fall back to their readout.
 */
export const moveGizmoOwner = {
	get armedFrame() {
		return armedFrame
	},
	arm(frame: string) {
		armedFrame = frame
	},
	disarm(frame: string) {
		if (armedFrame === frame) armedFrame = undefined
	},
}
