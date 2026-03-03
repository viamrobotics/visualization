<script lang="ts">
	import { Portal } from '@threlte/extras'
	import { Button } from '@viamrobotics/prime-core'
	import Lasso from './Lasso.svelte'
	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import FloatingPanel from '../overlay/FloatingPanel.svelte'
	import { traits, useWorld } from '$lib/ecs'
	import * as lassoTraits from './traits'
	import { BufferGeometryUtils } from 'three/examples/jsm/Addons.js'
	import { createBinaryPCD } from '$lib/pcd'
	import type { BufferGeometry } from 'three'
	import { useThrelte } from '@threlte/core'
	import { ElementRect } from 'runed'

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
	const isLassoMode = $derived(settings.current.interactionMode === 'lasso')

	const onCommitClick = () => {
		const entities = world.query(lassoTraits.LassoEnclosedPoints)

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
		if (enabled) {
			settings.current.interactionMode = 'lasso'
		}
	})

	const rect = new ElementRect(() => dom)
</script>

<Portal id="dashboard">
	<fieldset>
		<DashboardButton
			active={isLassoMode}
			icon="selection-drag"
			description="{isLassoMode ? 'Disable' : 'Enable'} lasso selection"
			onclick={() => {
				settings.current.interactionMode = isLassoMode ? 'navigate' : 'lasso'
			}}
		/>
	</fieldset>
</Portal>

{#if isLassoMode && rect.height > 0 && rect.width > 0}
	<Lasso />

	<Portal id="dom">
		<FloatingPanel
			isOpen
			exitable={false}
			title="Lasso"
			strategy="absolute"
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
