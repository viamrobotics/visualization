<!--
@component

Places a polyline gizmo one vertex per click, previewing the next segment as
the pointer moves. `Backspace` drops the last vertex, `Space` commits and
starts another polyline, `Enter` commits and exits, and `Escape` or
right-click discards the whole pending polyline. Clicking back on the first
vertex with three or more already placed closes the loop. Assumes it is only
rendered while `useGizmos().mode` is `'polyline'`.
-->
<script
	lang="ts"
	module
>
	const MIN_LOOP_VERTICES = 3
	const PLACEMENT_DOT_SIZE = 20

	/**
	 * The index of the existing vertex `point` should snap onto, or `undefined`
	 * if none is within `snapDistance`. Pure so the loop-closing and snapping
	 * decisions can be exercised without a scene.
	 */
	export const nearestVertex = (
		points: Vector3[],
		point: Vector3,
		snapDistance: number
	): number | undefined => {
		let best: number | undefined
		let bestSquared = snapDistance * snapDistance
		for (let i = 0; i < points.length; i++) {
			const squared = points[i].distanceToSquared(point)
			if (squared < bestSquared) {
				bestSquared = squared
				best = i
			}
		}
		return best
	}
</script>

<script lang="ts">
	import { Vector3 } from 'three'

	import { asRGB } from '$lib/buffer'
	import MeasurePoint from '$lib/components/MeasurePoint.svelte'
	import { DEFAULT_LINE_WIDTH } from '$lib/draw'
	import { selectOnly, traits, useWorld } from '$lib/ecs'
	import { useMouseRaycaster } from '$lib/hooks/useMouseRaycaster.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import ConfirmFloatingPanel from '../ConfirmFloatingPanel.svelte'
	import { cursorPoint } from '../cursor'
	import { cancelPending, confirmPending, POLYLINE_COLOR, spawnPending } from '../spawn'
	import { PolylineMeasure } from '../traits'
	import { useGizmos } from '../useGizmos.svelte'
	import { usePending } from '../usePending.svelte'

	const MM_TO_M = 0.001

	const world = useWorld()
	const gizmos = useGizmos()
	const settings = useSettings()

	let cursor = $state.raw<Vector3 | undefined>()
	let points = $state.raw<Vector3[]>([])

	const pending = usePending(() => ({
		onCancel,
		onConfirm,
		onCommitAndContinue,
		onUndo,
	}))

	const { onclick, onmove } = useMouseRaycaster(() => ({ enabled: true }))

	const hasSegment = $derived(points.length >= 2)
	const panelPosition = $derived.by<[number, number, number]>(() => {
		const last = points.at(-1)
		return last ? [last.x, last.y, last.z] : [0, 0, 0]
	})

	const snapDistance = $derived(gizmos.vertexSnapDistance * MM_TO_M)

	const getCursorPosition = (hit: Vector3): { position: Vector3; index?: number } => {
		const index =
			pending.current && settings.current.snapping
				? nearestVertex(points, hit, snapDistance)
				: undefined
		return {
			index,
			position: index === undefined ? hit : points[index].clone(),
		}
	}

	const flatPositions = (pts: Vector3[], preview?: Vector3): Float32Array => {
		const total = pts.length + (preview ? 1 : 0)
		const arr = new Float32Array(total * 3)
		for (let i = 0; i < pts.length; i++) {
			arr[i * 3 + 0] = pts[i].x
			arr[i * 3 + 1] = pts[i].y
			arr[i * 3 + 2] = pts[i].z
		}
		if (preview) {
			const i = pts.length
			arr[i * 3 + 0] = preview.x
			arr[i * 3 + 1] = preview.y
			arr[i * 3 + 2] = preview.z
		}
		return arr
	}

	const updatePending = (preview?: Vector3) => {
		if (!pending.current) return

		pending.current.set(traits.LinePositions, flatPositions(points, preview))
	}

	onmove((event) => {
		const hit = cursorPoint(event.intersections, pending.current)
		if (!hit) {
			cursor = undefined
			return
		}

		const { position } = getCursorPosition(hit)
		cursor = position
		if (pending.current) updatePending(position)
	})

	onclick((event) => {
		const hit = cursorPoint(event.intersections, pending.current)
		if (!hit) return

		const { position, index } = getCursorPosition(hit)

		if (pending.current) {
			if (index === 0 && points.length >= MIN_LOOP_VERTICES) {
				points = [...points, position]
				const committed = finalizePending()
				if (committed) selectOnly(world, committed)
				return
			}

			points = [...points, position]
			updatePending()
			return
		}

		const entity = spawnPending(world, {
			kind: 'polyline',
			position: new Vector3(),
			traits: [
				traits.LinePositions(new Float32Array()),
				traits.LineWidth(DEFAULT_LINE_WIDTH),
				traits.DotSize(PLACEMENT_DOT_SIZE),
				traits.Color(asRGB(POLYLINE_COLOR, { r: 0, g: 0, b: 0 })),
				traits.DotColors(POLYLINE_COLOR),
				...(gizmos.lineSpace === 'screen' ? [traits.ScreenSpace] : []),
				...(gizmos.lineMeasure === 'none' ? [] : [PolylineMeasure({ mode: gizmos.lineMeasure })]),
			],
		})

		pending.set(entity)
		points = [position]
		selectOnly(world, entity)
		updatePending(position)
	})

	const finalizePending = () => {
		if (!pending.current) return undefined

		const committed = pending.current
		committed.set(traits.LinePositions, flatPositions(points))
		confirmPending(committed)
		pending.set(undefined)
		points = []
		return committed
	}

	const onCommitAndContinue = () => {
		if (!pending.current || !hasSegment) return
		// Intentionally leaves the selection on the entity just committed rather
		// than starting the next polyline pre-selected: there is no next entity yet.
		finalizePending()
	}

	const onConfirm = () => {
		if (!pending.current || !hasSegment) return

		const committed = finalizePending()
		if (committed) selectOnly(world, committed)
		gizmos.exit()
	}

	const onCancel = () => {
		if (!pending.current) {
			gizmos.exit()
			return
		}

		const entity = pending.current
		if (entity.has(traits.Selected)) entity.remove(traits.Selected)
		cancelPending(entity)
		pending.set(undefined)
		points = []
	}

	const onUndo = () => {
		if (!pending.current || !hasSegment) return

		points = points.slice(0, -1)
		updatePending(cursor)
	}
</script>

{#if pending.current && hasSegment}
	<ConfirmFloatingPanel
		position={panelPosition}
		canUndo={hasSegment}
		canConfirm={hasSegment}
		canCommitAndContinue={hasSegment}
		onCancel={() => onCancel()}
		onConfirm={() => onConfirm()}
		onCommitAndContinue={() => onCommitAndContinue()}
		onUndo={() => onUndo()}
	/>
{/if}

{#if !pending.current && cursor}
	<MeasurePoint position={cursor.toArray()} />
{/if}
