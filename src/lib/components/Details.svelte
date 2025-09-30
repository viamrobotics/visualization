<script
	module
	lang="ts"
>
	import { OrientationVector } from '$lib/three/OrientationVector'
	import { Quaternion, Vector3 } from 'three'

	const vec3 = new Vector3()
	const quaternion = new Quaternion()
	const ov = new OrientationVector()
</script>

<script lang="ts">
	import { Check, Copy } from 'lucide-svelte'
	import { useTask } from '@threlte/core'
	import { Button, Icon } from '@viamrobotics/prime-core'
	import {
		useSelectedObject,
		useFocusedObject,
		useFocused,
		useFocusedObject3d,
		useSelectedObject3d,
	} from '$lib/hooks/useSelection.svelte'
	import { useDraggable } from '$lib/hooks/useDraggable.svelte'

	const { ...rest } = $props()

	const focused = useFocused()
	const focusedObject = useFocusedObject()
	const focusedObject3d = useFocusedObject3d()

	const selectedObject = useSelectedObject()
	const selectedObject3d = useSelectedObject3d()

	const object = $derived(focusedObject.current ?? selectedObject.current)
	const object3d = $derived(focusedObject3d.current ?? selectedObject3d.current)
	const worldPosition = $state({ x: 0, y: 0, z: 0 })
	const worldOrientation = $state({ x: 0, y: 0, z: 1, th: 0 })

	let copied = $state(false)

	const draggable = useDraggable('details')

	const { start, stop } = useTask(
		() => {
			object3d?.getWorldPosition(vec3)
			if (!vec3.equals(worldPosition)) {
				worldPosition.x = vec3.x
				worldPosition.y = vec3.y
				worldPosition.z = vec3.z
			}

			object3d?.getWorldQuaternion(quaternion)
			ov.setFromQuaternion(quaternion)

			if (!ov.equals(worldOrientation)) {
				worldOrientation.x = ov.x
				worldOrientation.y = ov.y
				worldOrientation.z = ov.z
				worldOrientation.th = ov.th
			}
		},
		{ autoStart: false }
	)

	$effect.pre(() => {
		if (object3d) {
			start()
		} else {
			stop()
		}
	})
</script>

{#if object}
	{@const geometry = object.geometry}
	<div
		class="border-medium bg-extralight absolute top-0 right-0 z-1000 m-2 w-60 border p-2 text-xs"
		style:transform="translate({draggable.current.x}px, {draggable.current.y}px)"
		{...rest}
	>
		<div class="flex items-center justify-between gap-2 pb-2">
			<div class="flex items-center gap-1">
				<button
					onmousedown={draggable.onDragStart}
					onmouseup={draggable.onDragEnd}
				>
					<Icon name="drag" />
				</button>
				{object.name}
			</div>
		</div>

		<div class="border-medium -mx-2 w-[100%+0.5rem] border-b"></div>

		<h3 class="text-subtle-2 flex justify-between py-2">
			Details

			<button
				onclick={async () => {
					navigator.clipboard.writeText(JSON.stringify($state.snapshot(object)))
					copied = true
					setTimeout(() => (copied = false), 1000)
				}}
			>
				{#if copied}
					<Check size={14} />
				{:else}
					<Copy size={14} />
				{/if}
			</button>
		</h3>

		<div class="flex flex-col gap-2.5">
			{#if worldPosition}
				<div>
					<strong class="font-semibold">world position</strong>

					<div class="flex gap-3">
						<div>
							<span class="text-subtle-2">x</span>
							{(worldPosition.x * 1000).toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2">y</span>
							{(worldPosition.y * 1000).toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2">z</span>
							{(worldPosition.z * 1000).toFixed(2)}
						</div>
					</div>
				</div>
			{/if}

			{#if worldOrientation}
				<div>
					<strong class="font-semibold">world orientation</strong>
					<div class="flex gap-3">
						<div>
							<span class="text-subtle-2">x</span>
							{worldOrientation.x.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2">y</span>
							{worldOrientation.y.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2">z</span>
							{worldOrientation.z.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2">th</span>
							{worldOrientation.th.toFixed(2)}
						</div>
					</div>
				</div>
			{/if}

			{#if geometry}
				{#if geometry.case === 'box'}
					{@const { dimsMm } = geometry.value}
					<div>
						<strong class="font-semibold">dimensions</strong>
						<div class="flex gap-3">
							<div>
								<span class="text-subtle-2">x</span>
								{dimsMm?.x ? dimsMm.x.toFixed(2) : '-'}
							</div>
							<div>
								<span class="text-subtle-2">y</span>
								{dimsMm?.y ? dimsMm.y.toFixed(2) : '-'}
							</div>
							<div>
								<span class="text-subtle-2">z</span>
								{dimsMm?.z ? dimsMm.z.toFixed(2) : '-'}
							</div>
						</div>
					</div>
				{:else if geometry.case === 'capsule'}
					{@const { radiusMm, lengthMm } = geometry.value}
					<div>
						<strong class="font-semibold">dimensions</strong>
						<div class="flex gap-3">
							<div>
								<span class="text-subtle-2">r</span>
								{radiusMm ? radiusMm.toFixed(2) : '-'}
							</div>
							<div>
								<span class="text-subtle-2">l</span>
								{lengthMm ? lengthMm.toFixed(2) : '-'}
							</div>
						</div>
					</div>
				{:else if geometry.case === 'sphere'}
					<div class="flex justify-between">
						<div>
							<strong class="font-semibold">dimensions</strong>
							<div class="flex gap-3">
								<div>
									<span class="text-subtle-2">r</span>
									{geometry.value.radiusMm.toFixed(2)}
								</div>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<h3 class="text-subtle-2 pt-3 pb-2">Actions</h3>

		{#if focused.current}
			<Button
				class="w-full"
				icon="arrow-left"
				variant="dark"
				onclick={() => focused.set()}
			>
				Exit object view
			</Button>
		{:else}
			<Button
				class="w-full"
				icon="image-filter-center-focus"
				onclick={() => focused.set(object.uuid)}
			>
				Enter object view
			</Button>
		{/if}
	</div>
{/if}
