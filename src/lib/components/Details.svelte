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
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const { ...rest } = $props()

	const focused = useFocused()
	const focusedObject = useFocusedObject()
	const focusedObject3d = useFocusedObject3d()
	const frames = useFrames()
	const settings = useSettings()
	const selectedObject = useSelectedObject()
	const selectedObject3d = useSelectedObject3d()

	const object = $derived(focusedObject.current ?? selectedObject.current)
	const object3d = $derived(focusedObject3d.current ?? selectedObject3d.current)
	const localPose = $derived(object?.pose)
	const worldPosition = $state({ x: 0, y: 0, z: 0 })
	const worldOrientation = $state({ x: 0, y: 0, z: 1, th: 0 })
	const geometryType = $derived.by(
		() => (object?.geometry?.case as 'none' | 'box' | 'sphere' | 'capsule' | undefined) ?? 'none'
	)
	const referenceFrame = $derived(object?.referenceFrame ?? 'world')
	const referenceFrameOptions = $derived(frames.getParentFrameOptions(object?.name ?? ''))
	const isFrameNode = $derived(
		frames.current.find((frame) => frame.name === object?.name) !== undefined
	)

	const updateLocalPosition = ({ x, y, z }: { x?: number; y?: number; z?: number }) => {
		if (!object || !object3d) return
		object.pose.x = x ?? object.pose.x
		object.pose.y = y ?? object.pose.y
		object.pose.z = z ?? object.pose.z
		object3d.position.set(
			(x ?? object3d.position.x * 1000) / 1000,
			(y ?? object3d.position.y * 1000) / 1000,
			(z ?? object3d.position.z * 1000) / 1000
		)

		frames.updateFrame(selectedObject.current?.name ?? '', referenceFrame, {
			x: x ?? object.pose.x,
			y: y ?? object.pose.y,
			z: z ?? object.pose.z,
			oX: object.pose.oX,
			oY: object.pose.oY,
			oZ: object.pose.oZ,
			theta: object.pose.theta,
		})
	}

	const updateLocalOrientation = ({
		oX,
		oY,
		oZ,
		theta,
	}: {
		oX?: number
		oY?: number
		oZ?: number
		theta?: number
	}) => {
		if (!object || !object3d) return
		object.pose.oX = oX ?? object.pose.oX
		object.pose.oY = oY ?? object.pose.oY
		object.pose.oZ = oZ ?? object.pose.oZ
		object.pose.theta = theta ?? object.pose.theta

		object3d.quaternion.set(
			oX ?? object3d.quaternion.x,
			oY ?? object3d.quaternion.y,
			oZ ?? object3d.quaternion.z,
			theta ?? object3d.quaternion.w
		)

		frames.updateFrame(selectedObject.current?.name ?? '', referenceFrame, {
			oX: oX ?? object.pose.oX,
			oY: oY ?? object.pose.oY,
			oZ: oZ ?? object.pose.oZ,
			theta: theta ?? object.pose.theta,
			x: object.pose.x,
			y: object.pose.y,
			z: object.pose.z,
		})
	}

	const setGeometryType = (type: 'none' | 'box' | 'sphere' | 'capsule') => {
		if (!object) return
		if (type === 'none') {
			object.geometry = undefined
			frames.updateFrame(
				selectedObject.current?.name ?? '',
				referenceFrame,
				{
					x: object.pose.x,
					y: object.pose.y,
					z: object.pose.z,
					oX: object.pose.oX,
					oY: object.pose.oY,
					oZ: object.pose.oZ,
					theta: object.pose.theta,
				},
				{ type: 'none' }
			)
		} else if (type === 'box') {
			object.geometry = { case: 'box', value: { dimsMm: { x: 100, y: 100, z: 100 } } }
			frames.updateFrame(
				selectedObject.current?.name ?? '',
				referenceFrame,
				{
					x: object.pose.x,
					y: object.pose.y,
					z: object.pose.z,
					oX: object.pose.oX,
					oY: object.pose.oY,
					oZ: object.pose.oZ,
					theta: object.pose.theta,
				},
				{ type: 'box', x: 100, y: 100, z: 100 }
			)
		} else if (type === 'sphere') {
			object.geometry = { case: 'sphere', value: { radiusMm: 100 } }
			frames.updateFrame(
				selectedObject.current?.name ?? '',
				referenceFrame,
				{
					x: object.pose.x,
					y: object.pose.y,
					z: object.pose.z,
					oX: object.pose.oX,
					oY: object.pose.oY,
					oZ: object.pose.oZ,
					theta: object.pose.theta,
				},
				{ type: 'sphere', r: 100 }
			)
		} else if (type === 'capsule') {
			object.geometry = { case: 'capsule', value: { radiusMm: 20, lengthMm: 100 } }
			frames.updateFrame(
				selectedObject.current?.name ?? '',
				referenceFrame,
				{
					x: object.pose.x,
					y: object.pose.y,
					z: object.pose.z,
					oX: object.pose.oX,
					oY: object.pose.oY,
					oZ: object.pose.oZ,
					theta: object.pose.theta,
				},
				{ type: 'capsule', r: 20, l: 100 }
			)
		}
	}

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
	{@const { geometry } = object}
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
					{@const { value } = geometry}
					<div>
						<strong class="font-semibold">dimensions</strong>
						<div class="flex gap-3">
							<div>
								<span class="text-subtle-2">r</span>
								{value.radiusMm ? value.radiusMm.toFixed(2) : '-'}
							</div>
							<div>
								<span class="text-subtle-2">l</span>
								{value.lengthMm ? value.lengthMm.toFixed(2) : '-'}
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

			{#if isFrameNode}
				{#if localPose}
					<div>
						<strong class="font-semibold">local position</strong>
						<div class="flex items-center gap-2">
							<div class="flex min-w-0 flex-1 items-center gap-1">
								<span class="text-subtle-2 text-xs">x</span>
								<input
									type="number"
									class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
									value={localPose.x}
									oninput={(e) => {
										updateLocalPosition({ x: parseFloat((e.target as HTMLInputElement).value) })
									}}
								/>
							</div>
							<div class="flex min-w-0 flex-1 items-center gap-1">
								<span class="text-subtle-2 text-xs">y</span>
								<input
									type="number"
									class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
									value={localPose.y}
									oninput={(e) => {
										updateLocalPosition({ y: parseFloat((e.target as HTMLInputElement).value) })
									}}
								/>
							</div>
							<div class="flex min-w-0 flex-1 items-center gap-1">
								<span class="text-subtle-2 text-xs">z</span>
								<input
									type="number"
									class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
									value={localPose.z}
									oninput={(e) => {
										updateLocalPosition({ z: parseFloat((e.target as HTMLInputElement).value) })
									}}
								/>
							</div>
						</div>
					</div>

					<div>
						<strong class="font-semibold">local orientation</strong>
						<div class="flex items-center gap-2">
							<div class="flex min-w-0 flex-1 items-center gap-1">
								<span class="text-subtle-2 text-xs">x</span>
								<input
									type="number"
									class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
									value={localPose.oX}
									step="0.01"
									oninput={(e) => {
										updateLocalOrientation({ oX: parseFloat((e.target as HTMLInputElement).value) })
									}}
								/>
							</div>
							<div class="flex min-w-0 flex-1 items-center gap-1">
								<span class="text-subtle-2 text-xs">y</span>
								<input
									type="number"
									class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
									value={localPose.oY}
									step="0.01"
									oninput={(e) => {
										updateLocalOrientation({ oY: parseFloat((e.target as HTMLInputElement).value) })
									}}
								/>
							</div>
							<div class="flex min-w-0 flex-1 items-center gap-1">
								<span class="text-subtle-2 text-xs">z</span>
								<input
									type="number"
									class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
									value={localPose.oZ}
									step="0.01"
									oninput={(e) => {
										updateLocalOrientation({ oZ: parseFloat((e.target as HTMLInputElement).value) })
									}}
								/>
							</div>
							<div class="flex min-w-0 flex-1 items-center gap-1">
								<span class="text-subtle-2 text-xs">th</span>
								<input
									type="number"
									class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
									value={localPose.theta}
									step="0.01"
									oninput={(e) => {
										updateLocalOrientation({
											theta: parseFloat((e.target as HTMLInputElement).value),
										})
									}}
								/>
							</div>
						</div>
					</div>
				{/if}

				<div>
					<strong class="font-semibold">Geometry</strong>
					<div class="grid grid-cols-2 gap-1">
						<Button
							variant={geometryType === 'none' ? 'primary' : 'ghost'}
							class="text-xs"
							onclick={() => setGeometryType('none')}>None</Button
						>
						<Button
							variant={geometryType === 'box' ? 'primary' : 'ghost'}
							class="text-xs"
							onclick={() => setGeometryType('box')}>Box</Button
						>
						<Button
							variant={geometryType === 'sphere' ? 'primary' : 'ghost'}
							class="text-xs"
							onclick={() => setGeometryType('sphere')}>Sphere</Button
						>
						<Button
							variant={geometryType === 'capsule' ? 'primary' : 'ghost'}
							class="text-xs"
							onclick={() => setGeometryType('capsule')}>Capsule</Button
						>
					</div>
				</div>

				<div>
					<strong class="font-semibold">Refrence Frame</strong>
					<div class="flex gap-3">
						<select
							class="w-full rounded border border-gray-300 px-2 py-1 text-sm"
							value={referenceFrame}
							onchange={(e) => {
								const newFrame = (e.target as HTMLSelectElement).value
								frames.setFrameParent(object.name, newFrame)
							}}
						>
							{#each referenceFrameOptions as option (option)}
								<option value={option}>{option}</option>
							{/each}
						</select>
					</div>
				</div>
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
