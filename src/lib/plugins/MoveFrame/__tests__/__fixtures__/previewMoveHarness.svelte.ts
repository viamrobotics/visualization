import type { JsonValue } from '@bufbuild/protobuf'
import type { MotionClient, robotApi } from '@viamrobotics/sdk'
import type { World } from 'koota'

import { flushSync, mount, unmount } from 'svelte'

import type { FramesContext } from '$lib/hooks/useFrames.svelte'

import { Pose } from '$lib/math'

import type { MoveOptions } from '../../parseMoveOptions'
import type { PreviewMove } from '../../usePreviewMove.svelte'

import PreviewMoveHost from './PreviewMoveHost.svelte'

/** One `doCommand` the harness is holding open, so a spec decides when — and whether — it answers. */
export interface PendingCommand {
	command: Record<string, JsonValue>
	signal: AbortSignal | undefined
	resolve: (value: JsonValue) => void
	reject: (error: unknown) => void
}

export interface PreviewMoveHarness {
	preview: PreviewMove
	world: World
	/** Every `doCommand` still awaiting an answer, oldest first. */
	pending: PendingCommand[]
	/**
	 * Re-key the invalidation input, standing in for anything the panel names there: dragging the
	 * gizmo to a new goal, editing the world state, switching motion service.
	 */
	invalidate: () => void
	flush: () => void
	/**
	 * Swap the frame system, the way a config revision does — `useFrames` refetches on every one,
	 * so this can happen while a plan is in flight.
	 */
	setParts: (next: robotApi.FrameSystemConfig[]) => void
	/** Unmount, the way closing the move panel or leaving move mode does. Safe to call twice. */
	dispose: () => void
	/**
	 * Unmount and hand the koota world id back. Koota's pool is 16 and only `destroy` returns one,
	 * so a spec that leaks them starves whatever runs later in the same browser context.
	 */
	destroy: () => void
}

/**
 * Mounts {@link PreviewMoveHost}, which is a component because `usePreviewMove` reads the world
 * off Svelte context. The inputs a spec drives are runes, which only compile in a `.svelte.ts`
 * file, so they live here and the assertions stay in the spec.
 */
export const createPreviewMoveHarness = (
	initialParts: robotApi.FrameSystemConfig[] = [],
	options: { moveOptions?: () => MoveOptions } = {}
): PreviewMoveHarness => {
	const pending: PendingCommand[] = []

	let key = $state(0)
	// Raw: replaced wholesale, and the hook reads it without wanting a proxy around protobuf classes.
	let parts = $state.raw(initialParts)

	// Typed off the real method so a changed `doCommand` signature fails here rather than compiling.
	const doCommand: MotionClient['doCommand'] = (command, callOptions) =>
		new Promise<JsonValue>((resolve, reject) => {
			pending.push({
				command: command as Record<string, JsonValue>,
				signal: callOptions?.signal,
				resolve,
				reject,
			})
		})

	const client = { doCommand } as unknown as MotionClient

	// A getter, so swapping the frame system is visible to the hook the way a refetch would be.
	const frames: FramesContext = {
		current: [],
		get parts() {
			return parts
		},
		kinematicsComponents: new Set<string>(),
	}

	let preview!: PreviewMove
	let world!: World

	// A real element, because `mount` needs one and an unattached node is not what production does.
	const target = document.createElement('div')
	document.body.append(target)

	const component = mount(PreviewMoveHost, {
		target,
		props: {
			frames,
			client: () => client,
			service: () => 'builtin',
			frameName: () => 'left-arm',
			destination: () => ({ referenceFrame: 'world', pose: new Pose(0, 0, 100) }),
			moveOptions:
				options.moveOptions ?? (() => ({ worldState: undefined, constraints: undefined })),
			invalidateOn: () => key,
			onReady: (nextPreview: PreviewMove, nextWorld: World) => {
				preview = nextPreview
				world = nextWorld
			},
		},
	})

	flushSync()

	let disposed = false
	const dispose = () => {
		if (disposed) return
		disposed = true
		unmount(component)
		target.remove()
	}

	return {
		preview,
		world,
		pending,
		invalidate: () => {
			key += 1
			flushSync()
		},
		setParts: (next) => {
			parts = next
			flushSync()
		},
		flush: flushSync,
		dispose,
		destroy: () => {
			dispose()
			world.destroy()
		},
	}
}
