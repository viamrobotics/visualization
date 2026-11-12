import type { PanelBox, PanelLayout } from './layoutPanel'
import type { PanelButtonNode } from './panelNode'

import { drawPanelIcon } from './panelIcons'
import { PANEL_THEME, type PanelButtonState, panelFont } from './panelTheme'

/** Which button indices in `layout.boxes` the pointer hovers and presses, or -1 for none. */
export interface PanelPointerState {
	hoveredIndex: number
	pressedIndex: number
}

const buttonState = (index: number, pointer: PanelPointerState): PanelButtonState => {
	if (index === pointer.pressedIndex) return 'pressed'
	if (index === pointer.hoveredIndex) return 'hover'
	return 'idle'
}

const drawButton = (
	context: CanvasRenderingContext2D,
	box: PanelBox,
	button: PanelButtonNode,
	state: PanelButtonState
) => {
	const centerX = box.x + box.width / 2
	const centerY = box.y + box.height / 2

	context.save()
	context.globalAlpha = button.isDisabled ? PANEL_THEME.disabledOpacity : 1

	context.fillStyle = PANEL_THEME.buttonFill[button.variant][state]
	context.beginPath()
	context.roundRect(box.x, box.y, box.width, box.height, box.height / 2)
	context.fill()

	if (button.content.kind === 'icon') {
		drawPanelIcon(
			context,
			button.content.icon,
			centerX,
			centerY,
			PANEL_THEME.iconSize,
			PANEL_THEME.textColor
		)
	} else {
		context.fillStyle = PANEL_THEME.textColor
		context.font = panelFont(PANEL_THEME.buttonFontSize)
		context.textAlign = 'center'
		context.textBaseline = 'middle'
		context.fillText(button.content.label, centerX, centerY)
	}

	context.restore()
}

/** Draws `layout` into `context`, whose transform already maps layout pixels to canvas pixels. */
export const drawPanel = (
	context: CanvasRenderingContext2D,
	layout: PanelLayout,
	pointer: PanelPointerState
) => {
	context.clearRect(0, 0, layout.width, layout.height)

	for (const [index, box] of layout.boxes.entries()) {
		const { node } = box

		if (node.type === 'stack') {
			if (!node.background) continue
			context.fillStyle = node.background
			context.beginPath()
			context.roundRect(box.x, box.y, box.width, box.height, node.radius)
			context.fill()
		} else if (node.type === 'text') {
			context.fillStyle = PANEL_THEME.textColor
			context.font = panelFont(node.fontSize)
			context.textAlign = 'left'
			context.textBaseline = 'middle'
			context.fillText(node.text, box.x, box.y + box.height / 2)
		} else {
			drawButton(context, box, node, buttonState(index, pointer))
		}
	}
}
