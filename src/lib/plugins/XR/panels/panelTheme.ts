import type { PanelButtonVariant } from './panelNode'

export type PanelButtonState = 'idle' | 'hover' | 'pressed'

/** Colors and sizes shared by every canvas panel. Hex because these fill a canvas, not the DOM. */
export const PANEL_THEME = {
	textColor: '#ffffff',
	lineHeight: 1.4,
	buttonHeight: 32,
	buttonPaddingX: 12,
	buttonFontSize: 14,
	iconSize: 18,
	disabledOpacity: 0.4,
	buttonFill: {
		primary: { idle: '#2563eb', hover: '#3b82f6', pressed: '#1d4ed8' },
		tertiary: {
			idle: 'rgba(255, 255, 255, 0)',
			hover: 'rgba(255, 255, 255, 0.12)',
			pressed: 'rgba(255, 255, 255, 0.2)',
		},
	} satisfies Record<PanelButtonVariant, Record<PanelButtonState, string>>,
} as const

const FONT_FAMILY = '"Public Sans", system-ui, sans-serif'

/** The canvas `font` string for text at `fontSize` layout pixels. */
export const panelFont = (fontSize: number) => `500 ${fontSize}px ${FONT_FAMILY}`
