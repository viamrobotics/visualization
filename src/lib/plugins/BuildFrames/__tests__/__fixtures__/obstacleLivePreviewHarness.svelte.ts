import { MachineConnectionEvent } from '@viamrobotics/sdk'
import { createResourceClient, useConnectionStatus } from '@viamrobotics/svelte-sdk'
import { flushSync } from 'svelte'
import { vi } from 'vitest'

import type { ObstacleGeometryConfig } from '#lib/obstacleAttributes.js'

import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
import { useFrames } from '#lib/hooks/useFrames.svelte.js'
import { type PartComponent, usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
import { usePartID } from '#lib/hooks/usePartID.svelte.js'
import { OBSTACLE_MODEL } from '#lib/obstacleAttributes.js'

import { useObstacleLivePreview } from '../../useObstacleLivePreview.svelte'

type Mode = 'build' | 'monitor'

const obstacle = (name: string, geometries: ObstacleGeometryConfig[]): PartComponent =>
	({ name, model: OBSTACLE_MODEL, attributes: { geometries } }) as PartComponent

/**
 * Runs `useObstacleLivePreview` for one obstacle named `name` on a connected machine, with
 * the mode, the obstacle's config geometries, the dirty flag and the preview toggle (on at
 * start) under test control.
 * Expects the hooks it replaces to be `vi.mock`ed by the spec.
 */
export const createObstacleLivePreviewHarness = (name: string, saved: ObstacleGeometryConfig[]) => {
	let mode = $state<Mode>('build')
	let geometries = $state.raw(saved)
	let isDirty = $state(false)
	const doCommand = vi.fn(() => Promise.resolve({}))

	vi.mocked(usePartID).mockReturnValue({ current: 'part' } as ReturnType<typeof usePartID>)
	vi.mocked(useEnvironment).mockReturnValue({
		get current() {
			return { mode }
		},
	} as ReturnType<typeof useEnvironment>)
	vi.mocked(useFrames).mockReturnValue({
		kinematicsComponents: new Set([name]),
	} as unknown as ReturnType<typeof useFrames>)
	vi.mocked(usePartConfig).mockReturnValue({
		get current() {
			return { components: [obstacle(name, geometries)] }
		},
		get isDirty() {
			return isDirty
		},
	} as ReturnType<typeof usePartConfig>)
	vi.mocked(useConnectionStatus).mockReturnValue({
		current: MachineConnectionEvent.CONNECTED,
	} as ReturnType<typeof useConnectionStatus>)
	vi.mocked(createResourceClient).mockReturnValue({
		current: { doCommand },
	} as unknown as ReturnType<typeof createResourceClient>)

	let preview: ReturnType<typeof useObstacleLivePreview> | undefined
	const disposeRoot = $effect.root(() => {
		preview = useObstacleLivePreview()
		preview.isEnabled = true
	})
	flushSync()

	return {
		disposeRoot,
		/** The `geometries` of every `set` command sent so far, oldest first. */
		sentGeometries: () =>
			doCommand.mock.calls.map(
				(call: unknown[]) =>
					(call[0] as { toJson: () => { geometries: unknown } }).toJson().geometries
			),
		edit: (next: ObstacleGeometryConfig[]) => {
			geometries = next
			isDirty = true
			flushSync()
		},
		setPreviewEnabled: (next: boolean) => {
			if (preview) preview.isEnabled = next
			flushSync()
		},
		discardAndSwitchTo: (nextMode: Mode) => {
			geometries = saved
			isDirty = false
			mode = nextMode
			flushSync()
		},
	}
}
