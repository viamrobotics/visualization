import {
	GenericComponentClient,
	type JsonValue,
	MachineConnectionEvent,
	Struct,
} from '@viamrobotics/sdk'
import { createResourceClient, useConnectionStatus } from '@viamrobotics/svelte-sdk'
import { untrack } from 'svelte'

import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
import { useFrames } from '#lib/hooks/useFrames.svelte.js'
import { useLogs } from '#lib/hooks/useLogs.svelte.js'
import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
import { usePartID } from '#lib/hooks/usePartID.svelte.js'
import {
	isObstacleComponent,
	obstacleGeometriesOf,
	type ObstacleGeometryConfig,
} from '#lib/obstacleAttributes.js'

import type { ObstaclePreviewToggle } from './obstaclePreviewToggle.svelte'

import { ObstaclePreviewController } from './ObstaclePreviewController'

const PREVIEW_DEBOUNCE_MS = 250

/**
 * Pushes a part-owned obstacle's draft geometries to the connected machine while in
 * build mode and preview is enabled, so the machine's own frame system shows the edit
 * before it is saved. An obstacle the machine does not report yet is skipped. Turning
 * preview off, or leaving build mode, sends the saved geometries back.
 *
 * Must be called during setup, inside the frames, part config and part ID providers.
 *
 * @returns The preview toggle, off at start, for the obstacle editor to show.
 */
export const useObstacleLivePreview = (): ObstaclePreviewToggle => {
	const partID = usePartID()
	const environment = useEnvironment()
	const frames = useFrames()
	const partConfig = usePartConfig()
	const logs = useLogs()
	const connectionStatus = useConnectionStatus(() => partID.current)

	let isEnabled = $state(false)
	const isConnected = $derived(connectionStatus.current === MachineConnectionEvent.CONNECTED)

	const isActive = $derived(isEnabled && environment.current.mode === 'build' && isConnected)

	const obstacles = $derived.by(() => {
		const byName: Record<string, ObstacleGeometryConfig[]> = {}

		for (const component of partConfig.current.components ?? []) {
			if (!isObstacleComponent(component)) continue
			if (!frames.kinematicsComponents.has(component.name)) continue
			byName[component.name] = obstacleGeometriesOf(component)
		}

		return byName
	})

	// A string, so a geometry edit (which rebuilds `obstacles`) leaves it equal and the clients below are not rebuilt.
	const obstacleNames = $derived(Object.keys(obstacles).toSorted().join('\n'))

	// Built per name in a derived, as `useCameraFrusta` does: the client factory reads context, so it cannot run from the send timer.
	const clients = $derived(
		new Map(
			(obstacleNames === '' ? [] : obstacleNames.split('\n')).map((name) => [
				name,
				createResourceClient(
					GenericComponentClient,
					() => partID.current,
					() => name
				),
			])
		)
	)

	const send = (name: string, obstacleGeometries: ObstacleGeometryConfig[]) => {
		const client = clients.get(name)
		if (client === undefined) return

		const resourceClient = client.current
		if (resourceClient === undefined) return

		resourceClient
			// The geometries are plain config JSON. Their interface lacks the index signature `JsonValue` wants.
			.doCommand(
				Struct.fromJson({ command: 'set', geometries: obstacleGeometries as unknown as JsonValue })
			)
			.catch((error: unknown) => {
				const reason = error instanceof Error ? error.message : String(error)
				logs.add(`Failed to preview obstacle "${name}": ${reason}`, 'error', {
					folder: 'frames',
				})
			})
	}

	const controller = new ObstaclePreviewController(send, PREVIEW_DEBOUNCE_MS)

	// The geometries as last saved. Turning preview off keeps the draft in the config, so restoring needs these instead.
	let savedObstacles = untrack(() => obstacles)
	$effect(() => {
		if (!partConfig.isDirty) savedObstacles = obstacles
	})

	let wasActive = false

	// Restores in the effect body, not a teardown: a teardown reads pre-change values, so it would see the discarded draft.
	$effect(() => {
		if (isActive) {
			wasActive = true
			controller.update(obstacles, partConfig.isDirty)
		} else if (wasActive) {
			wasActive = false
			untrack(() => controller.restore(savedObstacles))
		}
	})

	$effect(() => () => controller.stop())

	return {
		get isEnabled() {
			return isEnabled
		},
		set isEnabled(value) {
			isEnabled = value
		},
		unavailableReason(name) {
			if (!isConnected) return 'Connect to a machine to preview on it.'
			if (!frames.kinematicsComponents.has(name)) {
				return 'The machine does not report this obstacle yet.'
			}
			return undefined
		},
	}
}
