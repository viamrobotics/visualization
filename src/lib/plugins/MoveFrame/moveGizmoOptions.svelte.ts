let mode = $state<'translate' | 'rotate'>('translate')
let space = $state<'local' | 'world'>('world')

/**
 * How the move gizmo drags — the same transform / space choice the build-mode
 * dashboard offers. It lives beside the dashboard buttons rather than in a panel
 * because the dashboard is one row no matter how many move panels are open.
 */
export const moveGizmoOptions = {
	get mode() {
		return mode
	},
	set mode(value: 'translate' | 'rotate') {
		mode = value
	},
	get space() {
		return space
	},
	set space(value: 'local' | 'world') {
		space = value
	},
}
