import { Color } from 'three'

/**
 * The color each resource subtype draws in. The values are Tailwind's default palette at shade
 * 600, and at shade 400 for the lighter entries, written out so no host needs Tailwind at runtime.
 * They belong in `@viamrobotics/tailwind-config` once it ships a resource palette.
 */
export const resourceColors = {
	// components
	arm: '#e17100',
	camera: '#155dfc',
	base: '#45556c',
	board: '#009966',
	button: '#4a5565',
	encoder: '#5ea500',
	gantry: '#9810fa',
	gripper: '#0092b8',
	motor: '#f54900',
	movement_sensor: '#4f39f6',
	pose_tracker: '#ec003f',
	power_sensor: '#7f22fe',
	sensor: '#009689',
	servo: '#d08700',
	switch: '#57534d',
	webcam: '#0084d1',
	audio_in: '#00bcff',
	audio_out: '#a684ff',
	generic: '#99a1af',
	input_controller: '#ed6aff',
	// services
	motion: '#00a63e',
	navigation: '#e7000b',
	slam: '#e60076',
	vision: '#c800de',
	mlmodel: '#525252',
	discovery: '#52525c',
	data_manager: '#00d492',
	video: '#ff637e',
	world_state_store: '#ffb900',
} as const

/** The color `subtype` draws in, or `undefined` for a subtype with no assigned color. */
export const subtypeToColor = (subtype?: string) => {
	if (!subtype) return undefined
	const colorValue = resourceColors[subtype as keyof typeof resourceColors]
	if (!colorValue) return undefined
	return new Color(colorValue)
}
