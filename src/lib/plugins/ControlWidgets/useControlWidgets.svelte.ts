import { usePersistedStates } from '#lib/hooks/usePersistedStates.svelte.js'

const OPEN_WIDGETS_STORAGE_KEY = 'control-widgets'
const WIDGET_RECTS_STORAGE_KEY = 'control-widget-rects'

export interface OpenResourceWidget {
	resourceName: string
	widgetId: string
}

export interface WidgetRect {
	x: number
	y: number
	width: number
	height: number
}

export const isWidgetOpen = (
	list: OpenResourceWidget[],
	resourceName: string,
	widgetId: string
): boolean => list.some((w) => w.resourceName === resourceName && w.widgetId === widgetId)

export const addWidget = (
	list: OpenResourceWidget[],
	resourceName: string,
	widgetId: string
): OpenResourceWidget[] =>
	isWidgetOpen(list, resourceName, widgetId) ? list : [...list, { resourceName, widgetId }]

export const removeWidget = (
	list: OpenResourceWidget[],
	resourceName: string,
	widgetId: string
): OpenResourceWidget[] =>
	list.filter((w) => !(w.resourceName === resourceName && w.widgetId === widgetId))

export interface ControlWidgetsStore {
	openFor(partID: string): OpenResourceWidget[]
	isOpen(partID: string, resourceName: string, widgetId: string): boolean
	setOpen(partID: string, resourceName: string, widgetId: string, on: boolean): void
	rectFor(partID: string, resourceName: string, widgetId: string): WidgetRect | undefined
	saveRect(partID: string, resourceName: string, widgetId: string, rect: WidgetRect): void
}

/**
 * Self-contained state for the ControlWidgets plugin: which registry widget panels
 * are open per part, and their persisted geometry. Call it while a component under
 * `<Visualizer>` initializes. Every caller in that visualizer shares one store, kept
 * under the visualizer's `storageKey`.
 */
export const useControlWidgets = (): ControlWidgetsStore => {
	const persistedState = usePersistedStates()
	const open = persistedState<Record<string, OpenResourceWidget[]>>(OPEN_WIDGETS_STORAGE_KEY, {})
	const rects = persistedState<Record<string, WidgetRect>>(WIDGET_RECTS_STORAGE_KEY, {})

	return {
		openFor: (partID) => open.current[partID] ?? [],

		isOpen: (partID, resourceName, widgetId) =>
			isWidgetOpen(open.current[partID] ?? [], resourceName, widgetId),

		setOpen: (partID, resourceName, widgetId, on) => {
			const list = open.current[partID] ?? []
			const next = on
				? addWidget(list, resourceName, widgetId)
				: removeWidget(list, resourceName, widgetId)
			if (next.length === list.length) return

			open.current = { ...open.current, [partID]: next }
		},

		rectFor: (partID, resourceName, widgetId) =>
			rects.current[rectKey(partID, resourceName, widgetId)],

		saveRect: (partID, resourceName, widgetId, rect) => {
			rects.current = { ...rects.current, [rectKey(partID, resourceName, widgetId)]: rect }
		},
	}
}

const rectKey = (partID: string, resourceName: string, widgetId: string) =>
	`${partID} ${resourceName} ${widgetId}`
