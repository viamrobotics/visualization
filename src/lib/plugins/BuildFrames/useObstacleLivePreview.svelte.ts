import {
	GenericComponentClient,
	type JsonValue,
	MachineConnectionEvent,
	Struct,
} from '@viamrobotics/sdk'
import { createResourceClient, useConnectionStatus } from '@viamrobotics/svelte-sdk'

import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
import { useFrames } from '$lib/hooks/useFrames.svelte'
import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
import { usePartID } from '$lib/hooks/usePartID.svelte'
import {
	isObstacleComponent,
	obstacleGeometriesOf,
	type ObstacleGeometryConfig,
} from '$lib/obstacleAttributes'
import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'

import { ObstaclePreviewController } from './ObstaclePreviewController'

const PREVIEW_DEBOUNCE_MS = 250

/**
 * Pushes a part-owned obstacle's draft geometries to the connected machine while in
 * build mode, so the machine's own frame system shows the edit before it is saved.
 * An obstacle the machine does not report yet is skipped.
 *
 * Must be called during setup, inside the frames, part config and part ID providers.
 */
export const useObstacleLivePreview = () => {
	const partID = usePartID()
	const environment = useEnvironment()
	const frames = useFrames()
	const partConfig = usePartConfig()
	const logs = useLogs()
	const connectionStatus = useConnectionStatus(() => partID.current)

	const isActive = $derived(
		environment.current.mode === 'build' &&
			connectionStatus.current === MachineConnectionEvent.CONNECTED
	)

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

	$effect(() => {
		if (!isActive) return

		controller.update(obstacles, partConfig.isDirty)
	})

	// Separate from the update effect so its teardown runs only on deactivation, not on every edit.
	$effect(() => {
		if (!isActive) return

		return () => controller.stop()
	})
}
