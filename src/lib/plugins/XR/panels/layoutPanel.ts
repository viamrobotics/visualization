import type { PanelNode, PanelStackNode } from './panelNode'

import { PANEL_THEME } from './panelTheme'

/** A node placed in layout pixels, with the origin at the panel's top-left. */
export interface PanelBox {
	node: PanelNode
	x: number
	y: number
	width: number
	height: number
}

export interface PanelLayout {
	width: number
	height: number
	/** Every node in draw order. A parent always precedes its children. */
	boxes: PanelBox[]
}

/** Returns the advance width of `text` at `fontSize`, in layout pixels. */
export type MeasureText = (text: string, fontSize: number) => number

interface Size {
	width: number
	height: number
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

const measureStack = (
	stack: PanelStackNode,
	measureText: MeasureText,
	sizes: Map<PanelNode, Size>
): Size => {
	const childSizes = stack.children.map((child) => measure(child, measureText, sizes))
	const gaps = stack.gap * Math.max(0, childSizes.length - 1)
	const isRow = stack.direction === 'row'

	const mainAxis = sum(childSizes.map((size) => (isRow ? size.width : size.height))) + gaps
	const crossAxis = Math.max(0, ...childSizes.map((size) => (isRow ? size.height : size.width)))
	const insets = stack.padding * 2

	return {
		width: Math.max(stack.minWidth, (isRow ? mainAxis : crossAxis) + insets),
		height: Math.max(stack.minHeight, (isRow ? crossAxis : mainAxis) + insets),
	}
}

const measure = (node: PanelNode, measureText: MeasureText, sizes: Map<PanelNode, Size>): Size => {
	let size: Size

	if (node.type === 'text') {
		size = {
			width: measureText(node.text, node.fontSize),
			height: node.fontSize * PANEL_THEME.lineHeight,
		}
	} else if (node.type === 'button') {
		const width =
			node.content.kind === 'icon'
				? PANEL_THEME.buttonHeight
				: measureText(node.content.label, PANEL_THEME.buttonFontSize) +
					PANEL_THEME.buttonPaddingX * 2
		size = { width, height: PANEL_THEME.buttonHeight }
	} else {
		size = measureStack(node, measureText, sizes)
	}

	sizes.set(node, size)
	return size
}

// Label buttons fill a column's width, matching flexbox's default `align-items: stretch`.
const stretchesInColumn = (node: PanelNode) =>
	node.type === 'button' && node.content.kind === 'label'

const place = (box: PanelBox, sizes: Map<PanelNode, Size>, boxes: PanelBox[]) => {
	boxes.push(box)

	const { node } = box
	if (node.type !== 'stack') return

	const innerWidth = box.width - node.padding * 2
	const innerHeight = box.height - node.padding * 2
	let cursor = node.direction === 'row' ? box.x + node.padding : box.y + node.padding

	for (const child of node.children) {
		const size = sizes.get(child)
		if (!size) continue

		if (node.direction === 'row') {
			const y = box.y + node.padding + (innerHeight - size.height) / 2
			place({ node: child, x: cursor, y, ...size }, sizes, boxes)
			cursor += size.width + node.gap
		} else {
			const width = stretchesInColumn(child) ? innerWidth : size.width
			place(
				{ node: child, x: box.x + node.padding, y: cursor, width, height: size.height },
				sizes,
				boxes
			)
			cursor += size.height + node.gap
		}
	}
}

/** Measures and places every node under `root`. */
export const layoutPanel = (root: PanelNode, measureText: MeasureText): PanelLayout => {
	const sizes = new Map<PanelNode, Size>()
	const size = measure(root, measureText, sizes)
	const boxes: PanelBox[] = []

	place({ node: root, x: 0, y: 0, ...size }, sizes, boxes)

	return { ...size, boxes }
}
