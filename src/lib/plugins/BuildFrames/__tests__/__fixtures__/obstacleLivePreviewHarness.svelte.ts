import { MachineConnectionEvent } from '@viamrobotics/sdk'
import { createResourceClient, useConnectionStatus } from '@viamrobotics/svelte-sdk'
import { flushSync } from 'svelte'
import { vi } from 'vitest'

import type { ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
import { useFrames } from '$lib/hooks/useFrames.svelte'
import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
import { usePartID } from '$lib/hooks/usePartID.svelte'
import { OBSTACLE_MODEL } from '$lib/obstacleAttributes'
import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'

import { useObstacleLivePreview } from '../../useObstacleLivePreview.svelte'

type Mode = 'build' | 'monitor'

const obstacle = (name: string, geometries: ObstacleGeometryConfig[]): PartComponent =>
	({ name, model: OBSTACLE_MODEL, attributes: { geometries } }) as PartComponent

/**
 * Runs `useObstacleLivePreview` for one obstacle named `name` on a connected machine,
 * with the mode, the obstacle's config geometries and the dirty flag under test control.
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
	vi.mocked(useLogs).mockReturnValue({ add: vi.fn() } as unknown as ReturnType<typeof useLogs>)
	vi.mocked(useConnectionStatus).mockReturnValue({
		current: MachineConnectionEvent.CONNECTED,
	} as ReturnType<typeof useConnectionStatus>)
	vi.mocked(createResourceClient).mockReturnValue({
		current: { doCommand },
	} as unknown as ReturnType<typeof createResourceClient>)

	const disposeRoot = $effect.root(() => {
		useObstacleLivePreview()
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
		discardAndSwitchTo: (nextMode: Mode) => {
			geometries = saved
			isDirty = false
			mode = nextMode
			flushSync()
		},
	}
}
