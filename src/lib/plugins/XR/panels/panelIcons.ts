/**
 * Icon outlines from Lucide (https://lucide.dev), ISC License,
 * Copyright (c) 2026 Lucide Icons and Contributors. Each icon is a list of
 * SVG path strings on Lucide's 24-unit grid. Lines and circles from the
 * originals are rewritten as path data so one `Path2D` draws every part.
 */
const ICON_PATHS = {
	'undo-2': ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11'],
	'redo-2': ['m15 14 5-5-5-5', 'M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13'],
	locate: ['M2 12H5', 'M19 12H22', 'M12 2V5', 'M12 19V22', 'M5 12a7 7 0 1 0 14 0a7 7 0 1 0-14 0'],
	plus: ['M5 12h14', 'M12 5v14'],
	'move-3d': ['M5 3v16h16', 'm5 19 6-6', 'm2 6 3-3 3 3', 'm18 16 3 3-3 3'],
	'rotate-3d': [
		'M16.466 7.5C15.643 4.237 13.952 2 12 2 9.239 2 7 6.477 7 12s2.239 10 5 10c.342 0 .677-.069 1-.2',
		'm15.194 13.707 3.814 1.86-1.86 3.814',
		'M19 15.57c-1.804.885-4.274 1.43-7 1.43-5.523 0-10-2.239-10-5s4.477-5 10-5c4.838 0 8.873 1.718 9.8 4',
	],
	'scale-3d': [
		'M5 7v11a1 1 0 0 0 1 1h11',
		'M5.293 18.707 11 13',
		'M17 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
		'M3 5a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
	],
} as const satisfies Record<string, readonly string[]>

export type PanelIconName = keyof typeof ICON_PATHS

const LUCIDE_GRID_SIZE = 24
const LUCIDE_STROKE_WIDTH = 2

// Built on first draw rather than at import, since Path2D only exists in the browser.
const iconPaths = new Map<PanelIconName, Path2D>()

const getIconPath = (icon: PanelIconName) => {
	let path = iconPaths.get(icon)
	if (!path) {
		path = new Path2D(ICON_PATHS[icon].join(' '))
		iconPaths.set(icon, path)
	}
	return path
}

/** Strokes `icon` centered on (`centerX`, `centerY`), `size` layout pixels wide. */
export const drawPanelIcon = (
	context: CanvasRenderingContext2D,
	icon: PanelIconName,
	centerX: number,
	centerY: number,
	size: number,
	color: string
) => {
	const scale = size / LUCIDE_GRID_SIZE

	context.save()
	context.translate(centerX - size / 2, centerY - size / 2)
	context.scale(scale, scale)
	context.strokeStyle = color
	context.lineWidth = LUCIDE_STROKE_WIDTH
	context.lineCap = 'round'
	context.lineJoin = 'round'
	context.stroke(getIconPath(icon))
	context.restore()
}
