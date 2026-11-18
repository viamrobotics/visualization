import type { PanelIconName } from './panelIcons'

export type PanelButtonVariant = 'primary' | 'tertiary'

export interface PanelTextNode {
	type: 'text'
	text: string
	fontSize: number
}

export interface PanelButtonNode {
	type: 'button'
	content: { kind: 'icon'; icon: PanelIconName } | { kind: 'label'; label: string }
	variant: PanelButtonVariant
	isDisabled: boolean
	onclick: () => void
}

export interface PanelStackNode {
	type: 'stack'
	direction: 'row' | 'column'
	gap: number
	padding: number
	minWidth: number
	minHeight: number
	/** Fill behind the stack. Omitted for a stack that only groups its children. */
	background?: string
	radius: number
	children: PanelNode[]
}

/** One element of a canvas panel. Sizes are in layout pixels. */
export type PanelNode = PanelTextNode | PanelButtonNode | PanelStackNode

const DEFAULT_FONT_SIZE = 14

interface ButtonOptions {
	variant?: PanelButtonVariant
	disabled?: boolean
}

interface StackOptions {
	gap?: number
	padding?: number
	minWidth?: number
	minHeight?: number
	background?: string
	radius?: number
}

export const panelText = (text: string, options: { fontSize?: number } = {}): PanelTextNode => ({
	type: 'text',
	text,
	fontSize: options.fontSize ?? DEFAULT_FONT_SIZE,
})

export const panelIconButton = (
	icon: PanelIconName,
	onclick: () => void,
	options: ButtonOptions = {}
): PanelButtonNode => ({
	type: 'button',
	content: { kind: 'icon', icon },
	variant: options.variant ?? 'tertiary',
	isDisabled: options.disabled ?? false,
	onclick,
})

export const panelLabelButton = (
	label: string,
	onclick: () => void,
	options: ButtonOptions = {}
): PanelButtonNode => ({
	type: 'button',
	content: { kind: 'label', label },
	variant: options.variant ?? 'tertiary',
	isDisabled: options.disabled ?? false,
	onclick,
})

const panelStack = (
	direction: PanelStackNode['direction'],
	children: PanelNode[],
	options: StackOptions
): PanelStackNode => ({
	type: 'stack',
	direction,
	gap: options.gap ?? 0,
	padding: options.padding ?? 0,
	minWidth: options.minWidth ?? 0,
	minHeight: options.minHeight ?? 0,
	background: options.background,
	radius: options.radius ?? 0,
	children,
})

/** Lays children out left to right, centered vertically. */
export const panelRow = (children: PanelNode[], options: StackOptions = {}) =>
	panelStack('row', children, options)

/** Lays children out top to bottom. Label buttons stretch to the column's width. */
export const panelColumn = (children: PanelNode[], options: StackOptions = {}) =>
	panelStack('column', children, options)
