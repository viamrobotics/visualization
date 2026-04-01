<script lang="ts">
	import type { BufferGeometry } from 'three'

	import { useThrelte } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { Button } from '@viamrobotics/prime-core'
	import { ElementRect } from 'runed'
	import { BufferGeometryUtils } from 'three/examples/jsm/Addons.js'

	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import { traits, useWorld } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { createBinaryPCD } from '$lib/pcd'

	import FloatingPanel from '../overlay/FloatingPanel.svelte'
	import Lasso from './Lasso.svelte'
	import * as selectionTraits from './traits'

	interface Props {
		/** Whether to auto-enable lasso mode when the component mounts */
		enabled?: boolean

		/** Fires when the user has committed to a lasso selection */
		onSelection: (pcd: Blob) => void
	}

	let { enabled = false, onSelection }: Props = $props()

	const { dom } = useThrelte()
	const world = useWorld()
	const settings = useSettings()
	const isSelectionMode = $derived(settings.current.interactionMode === 'select')

	const onCommitClick = () => {
		const entities = world.query(selectionTraits.SelectionEnclosedPoints)

		const geometries: BufferGeometry[] = []
		for (const entity of entities) {
			const geometry = entity.get(traits.BufferGeometry)

			if (geometry) {
				geometries.push(geometry)
			}
		}

		const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries)
		const positions = mergedGeometry.getAttribute('position').array as Float32Array

		const pcd = createBinaryPCD(positions)

		onSelection(pcd)

		for (const entity of entities) {
			if (world.has(entity)) {
				entity.destroy()
			}
		}
	}

	$effect(() => {
		if (isSelectionMode) {
			settings.current.cameraMode = 'orthographic'
		}
	})

	$effect(() => {
		if (enabled) {
			settings.current.interactionMode = 'select'
		}
	})

	const rect = new ElementRect(() => dom)
</script>

<Portal id="dashboard">
	<fieldset>
		<DashboardButton
			active={isSelectionMode}
			icon="selection-drag"
			description="{isSelectionMode ? 'Disable' : 'Enable'} selection"
			onclick={() => {
				settings.current.interactionMode = isSelectionMode ? 'navigate' : 'select'
			}}
		/>
	</fieldset>
</Portal>

{#if isSelectionMode && rect.height > 0 && rect.width > 0}
	<Lasso />

	<Portal id="dom">
		<FloatingPanel
			isOpen
			exitable={false}
			title="Lasso"
			defaultSize={{ width: 445, height: 100 }}
			defaultPosition={{ x: rect.width / 2 - 200, y: rect.height - 10 - 100 }}
		>
			<div class="flex items-center gap-4 p-4 text-xs">
				Shift + click and drag to make a lasso selection.
				<Button
					onclick={onCommitClick}
					variant="success">Commit selection</Button
				>
			</div>
		</FloatingPanel>
	</Portal>
{/if}
