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
	import WeblabActive from './weblab/WeblabActive.svelte'
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	const { ...rest } = $props()

	const focused = useFocused()
	const focusedObject = useFocusedObject()
	const focusedObject3d = useFocusedObject3d()
	const frames = useFrames()
	const partConfig = usePartConfig()
	const selectedObject = useSelectedObject()
	const selectedObject3d = useSelectedObject3d()

	const object = $derived(focusedObject.current ?? selectedObject.current)
	const object3d = $derived(focusedObject3d.current ?? selectedObject3d.current)
	const worldPosition = $state({ x: 0, y: 0, z: 0 })
	const worldOrientation = $state({ x: 0, y: 0, z: 1, th: 0 })
	let geometryType = $derived.by(
		() =>
			(object?.geometry?.geometryType.case as 'none' | 'box' | 'sphere' | 'capsule' | undefined) ??
			'none'
	)

	const localPose = $derived(object?.pose)
	const referenceFrame = $derived(object?.referenceFrame ?? 'world')
	const referenceFrameOptions = $derived(frames.getParentFrameOptions(object?.name ?? ''))
	const isFrameNode = $derived(
		frames.current.find((frame) => frame.name === object?.name) !== undefined
	)
	let copied = $state(false)

	const draggable = useDraggable('details')

	const updateLocalPosition = ({ x, y, z }: { x?: number; y?: number; z?: number }) => {
		if (!object) return

		partConfig.updateFrame(selectedObject.current?.name ?? '', referenceFrame, {
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
		if (!object) return

		partConfig.updateFrame(selectedObject.current?.name ?? '', referenceFrame, {
			oX: oX ?? object.pose.oX,
			oY: oY ?? object.pose.oY,
			oZ: oZ ?? object.pose.oZ,
			theta: theta ?? object.pose.theta,
			x: object.pose.x,
			y: object.pose.y,
			z: object.pose.z,
		})
	}

	const updateGeometry = (geometry: {
		type: 'none' | 'box' | 'sphere' | 'capsule'
		r?: number
		l?: number
		x?: number
		y?: number
		z?: number
	}) => {
		if (!object) return
		let geometryObject: {
			type: 'box' | 'sphere' | 'capsule'
			x?: number
			y?: number
			z?: number
			r?: number
			l?: number
		}
		if (geometry.type === 'box') {
			const currentGeometry = object.geometry?.geometryType.value as {
				dimsMm: { x: number; y: number; z: number }
			}
			geometryObject = {
				type: 'box',
				x: geometry.x ?? currentGeometry?.dimsMm?.x,
				y: geometry.y ?? currentGeometry?.dimsMm?.y,
				z: geometry.z ?? currentGeometry?.dimsMm?.z,
			}
		} else if (geometry.type === 'sphere') {
			const currentGeometry = object.geometry?.geometryType.value as { radiusMm: number }
			geometryObject = {
				type: 'sphere',
				r: geometry.r ?? currentGeometry?.radiusMm,
			}
		} else if (geometry.type === 'capsule') {
			const currentGeometry = object.geometry?.geometryType.value as {
				radiusMm: number
				lengthMm: number
			}
			geometryObject = {
				type: 'capsule',
				r: geometry.r ?? currentGeometry?.radiusMm,
				l: geometry.l ?? currentGeometry?.lengthMm,
			}
		}

		partConfig.updateFrame(
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
			{ ...geometryObject! }
		)
	}

	const setGeometryType = (type: 'none' | 'box' | 'sphere' | 'capsule') => {
		if (type === geometryType) return
		geometryType = type
		if (!object) return
		if (type === 'none') {
			partConfig.updateFrame(
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
			partConfig.updateFrame(
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
			partConfig.updateFrame(
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
			partConfig.updateFrame(
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

	const setFrameParent = (parentName: string) => {
		if (!object) return
		partConfig.updateFrame(object.name, parentName, {
			x: object.pose.x,
			y: object.pose.y,
			z: object.pose.z,
			oX: object.pose.oX,
			oY: object.pose.oY,
			oZ: object.pose.oZ,
			theta: object.pose.theta,
		})
	}

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
	<div
		class="border-medium bg-extralight absolute top-0 right-0 z-1000 m-2 w-80 border p-2 text-xs"
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
							<span class="text-subtle-2">X</span>
							{(worldPosition.x * 1000).toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2">Y</span>
							{(worldPosition.y * 1000).toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2">Z</span>
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
							<span class="text-subtle-2">X</span>
							{worldOrientation.x.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2">Y</span>
							{worldOrientation.y.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2">Z</span>
							{worldOrientation.z.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2">TH</span>
							{worldOrientation.th.toFixed(2)}
						</div>
					</div>
				</div>
			{/if}

			<WeblabActive experiment="MOTION_TOOLS_EDIT_FRAME">
				{#if isFrameNode}
					<div>
						<strong class="font-semibold">parent frame</strong>
						<div class="flex gap-3">
							<select
								aria-label="parent frame name dropdown"
								class="w-full rounded border border-gray-300 px-2 py-1 text-sm"
								value={referenceFrame}
								onchange={(e) => {
									const newFrame = (e.target as HTMLSelectElement).value
									setFrameParent(newFrame)
								}}
							>
								{#each referenceFrameOptions as option (option)}
									<option value={option}>{option}</option>
								{/each}
							</select>
						</div>
					</div>
				{:else}
					<div>
						<strong class="font-semibold">parent frame</strong>
						<div class="flex gap-3">
							<div>
								<span
									class="text-subtle-2"
									aria-label="parent frame name">name</span
								>
								{referenceFrame}
							</div>
						</div>
					</div>
				{/if}

				{#if localPose}
					{#if isFrameNode}
						<div>
							<strong class="font-semibold">local position</strong>
							<div class="flex items-center gap-2">
								<div class="flex min-w-0 flex-1 items-center gap-1">
									<span class="text-subtle-2 text-xs">X</span>
									<input
										type="number"
										aria-label="local position x coordinate input"
										class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={localPose.x.toFixed(2)}
										oninput={(e) => {
											updateLocalPosition({ x: parseFloat((e.target as HTMLInputElement).value) })
										}}
									/>
								</div>
								<div class="flex min-w-0 flex-1 items-center gap-1">
									<span class="text-subtle-2 text-xs">Y</span>
									<input
										type="number"
										aria-label="local position y coordinate input"
										class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={localPose.y.toFixed(2)}
										oninput={(e) => {
											updateLocalPosition({ y: parseFloat((e.target as HTMLInputElement).value) })
										}}
									/>
								</div>
								<div class="flex min-w-0 flex-1 items-center gap-1">
									<span class="text-subtle-2 text-xs">Z</span>
									<input
										type="number"
										aria-label="local position z coordinate input"
										class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={localPose.z.toFixed(2)}
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
									<span class="text-subtle-2 text-xs">X</span>
									<input
										type="number"
										aria-label="local orientation x coordinate input"
										class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={localPose.oX.toFixed(2)}
										step="0.01"
										oninput={(e) => {
											updateLocalOrientation({
												oX: parseFloat((e.target as HTMLInputElement).value),
											})
										}}
									/>
								</div>
								<div class="flex min-w-0 flex-1 items-center gap-1">
									<span class="text-subtle-2 text-xs">Y</span>
									<input
										type="number"
										aria-label="local orientation y coordinate input"
										class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={localPose.oY.toFixed(2)}
										step="0.01"
										oninput={(e) => {
											updateLocalOrientation({
												oY: parseFloat((e.target as HTMLInputElement).value),
											})
										}}
									/>
								</div>
								<div class="flex min-w-0 flex-1 items-center gap-1">
									<span class="text-subtle-2 text-xs">Z</span>
									<input
										type="number"
										aria-label="local orientation z coordinate input"
										class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={localPose.oZ.toFixed(2)}
										step="0.01"
										oninput={(e) => {
											updateLocalOrientation({
												oZ: parseFloat((e.target as HTMLInputElement).value),
											})
										}}
									/>
								</div>
								<div class="flex min-w-0 flex-1 items-center gap-1">
									<span class="text-subtle-2 text-xs">TH</span>
									<input
										type="number"
										aria-label="local orientation theta degrees input"
										class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={localPose.theta.toFixed(2)}
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
					{:else}
						<div>
							<strong class="font-semibold">local position</strong>

							<div class="flex gap-3">
								<div>
									<span
										class="text-subtle-2"
										aria-label="local position x coordinate">X</span
									>
									{localPose.x.toFixed(2)}
								</div>
								<div>
									<span
										class="text-subtle-2"
										aria-label="local position y coordinate">Y</span
									>
									{localPose.y.toFixed(2)}
								</div>
								<div>
									<span
										class="text-subtle-2"
										aria-label="local position z coordinate">Z</span
									>
									{localPose.z.toFixed(2)}
								</div>
							</div>
						</div>

						<div>
							<strong class="font-semibold">local orientation</strong>
							<div class="flex gap-3">
								<div>
									<span
										class="text-subtle-2"
										aria-label="local orientation x coordinate">X</span
									>
									{localPose.oX.toFixed(2)}
								</div>
								<div>
									<span
										class="text-subtle-2"
										aria-label="local orientation y coordinate">Y</span
									>
									{localPose.oY.toFixed(2)}
								</div>
								<div>
									<span
										class="text-subtle-2"
										aria-label="local orientation z coordinate">Z</span
									>
									{localPose.oZ.toFixed(2)}
								</div>
								<div>
									<span
										class="text-subtle-2"
										aria-label="local orientation theta degrees">TH</span
									>
									{localPose.theta.toFixed(2)}
								</div>
							</div>
						</div>
					{/if}
				{/if}

				{#if isFrameNode}
					<div>
						<strong class="font-semibold">geometry</strong>
						<div class="grid grid-cols-4 gap-1">
							<Button
								variant={geometryType === 'none' ? 'dark' : 'primary'}
								class="h-6 px-2 py-1 text-xs"
								onclick={() => setGeometryType('none')}>None</Button
							>
							<Button
								variant={geometryType === 'box' ? 'dark' : 'primary'}
								class="h-6 px-2 py-1 text-xs"
								onclick={() => setGeometryType('box')}>Box</Button
							>
							<Button
								variant={geometryType === 'sphere' ? 'dark' : 'primary'}
								class="h-6 px-2 py-1 text-xs"
								onclick={() => setGeometryType('sphere')}>Sphere</Button
							>
							<Button
								variant={geometryType === 'capsule' ? 'dark' : 'primary'}
								class="h-6 px-2 py-1 text-xs"
								onclick={() => setGeometryType('capsule')}>Capsule</Button
							>
						</div>
					</div>
					{#if object.geometry}
						{#if object.geometry?.geometryType.case === 'box'}
							{@const { dimsMm } = object.geometry.geometryType.value}
							<div>
								<strong class="font-semibold">dimensions (box)</strong>
								<div class="flex items-center gap-2">
									<span class="text-subtle-2">X</span>
									<input
										type="number"
										aria-label="box dimensions x value input"
										class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={dimsMm?.x ? dimsMm.x.toFixed(2) : '-'}
										oninput={(e) => {
											updateGeometry({
												type: 'box',
												x: parseFloat((e.target as HTMLInputElement).value),
											})
										}}
									/>
									<span class="text-subtle-2">Y</span>
									<input
										type="number"
										aria-label="box dimensions y value input"
										class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={dimsMm?.y ? dimsMm.y.toFixed(2) : '-'}
										oninput={(e) => {
											updateGeometry({
												type: 'box',
												y: parseFloat((e.target as HTMLInputElement).value),
											})
										}}
									/>
									<span class="text-subtle-2">Z</span>
									<input
										type="number"
										aria-label="box dimensions z value input"
										class="min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={dimsMm?.z ? dimsMm.z.toFixed(2) : '-'}
										oninput={(e) => {
											updateGeometry({
												type: 'box',
												z: parseFloat((e.target as HTMLInputElement).value),
											})
										}}
									/>
								</div>
							</div>
						{/if}
						{#if object.geometry?.geometryType.case === 'capsule'}
							{@const { radiusMm, lengthMm } = object.geometry.geometryType.value}
							<div>
								<strong class="font-semibold">dimensions (capsule)</strong>
								<div class="flex items-center gap-2">
									<span class="text-subtle-2">R</span>
									<input
										type="number"
										aria-label="capsule dimensions radius value input"
										class="max-w-24 min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={radiusMm ? radiusMm.toFixed(2) : '-'}
										oninput={(e) => {
											updateGeometry({
												type: 'capsule',
												r: parseFloat((e.target as HTMLInputElement).value),
											})
										}}
									/>
									<span class="text-subtle-2">L</span>
									<input
										type="number"
										class="max-w-24 min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
										value={lengthMm ? lengthMm.toFixed(2) : '-'}
										oninput={(e) => {
											updateGeometry({
												type: 'capsule',
												l: parseFloat((e.target as HTMLInputElement).value),
											})
										}}
									/>
								</div>
							</div>
						{/if}
						{#if object.geometry?.geometryType.case === 'sphere'}
							{@const { radiusMm } = object.geometry.geometryType.value}
							<div>
								<strong class="font-semibold">dimensions (sphere)</strong>
								<div class="flex items-center gap-2">
									<div class="flex min-w-0 flex-1 items-center gap-1">
										<span class="text-subtle-2 text-xs">R</span>
										<input
											type="number"
											aria-label="sphere dimensions radius value input"
											class="max-w-24 min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
											value={radiusMm ? radiusMm.toFixed(2) : '-'}
											oninput={(e) => {
												updateGeometry({
													type: 'sphere',
													r: parseFloat((e.target as HTMLInputElement).value),
												})
											}}
										/>
									</div>
								</div>
							</div>
						{/if}
					{/if}
				{:else if object.geometry}
					{#if object.geometry.geometryType.case === 'box'}
						{@const { dimsMm } = object.geometry.geometryType.value}
						<div>
							<strong class="font-semibold">dimensions (box)</strong>
							<div class="flex items-center gap-2">
								<div>
									<span class="text-subtle-2">X</span>
									{dimsMm?.x ? dimsMm.x.toFixed(2) : '-'}
								</div>
								<div>
									<span class="text-subtle-2">Y</span>
									{dimsMm?.y ? dimsMm.y.toFixed(2) : '-'}
								</div>
								<div>
									<span class="text-subtle-2">Z</span>
									{dimsMm?.z ? dimsMm.z.toFixed(2) : '-'}
								</div>
							</div>
						</div>
					{:else if object.geometry.geometryType.case === 'capsule'}
						{@const { value } = object.geometry.geometryType}
						<div>
							<strong class="font-semibold">dimensions (capsule)</strong>
							<div class="flex items-center gap-2">
								<div>
									<span class="text-subtle-2">R</span>
									{value.radiusMm ? value.radiusMm.toFixed(2) : '-'}
								</div>
								<div>
									<span class="text-subtle-2">L</span>
									{value.lengthMm ? value.lengthMm.toFixed(2) : '-'}
								</div>
							</div>
						</div>
					{:else if object.geometry.geometryType.case === 'sphere'}
						<div class="flex justify-between">
							<div>
								<strong class="font-semibold">dimensions (sphere)</strong>
								<div class="flex gap-3">
									<div>
										<span class="text-subtle-2">R</span>
										{object.geometry.geometryType.value.radiusMm.toFixed(2)}
									</div>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</WeblabActive>

			<WeblabActive
				experiment="MOTION_TOOLS_EDIT_FRAME"
				renderIfActive={false}
			>
				{#if object.geometry}
					{#if object.geometry.geometryType.case === 'box'}
						{@const { dimsMm } = object.geometry.geometryType.value}
						<div>
							<strong class="font-semibold">dimensions (box)</strong>
							<div class="flex gap-3">
								<div>
									<span class="text-subtle-2">X</span>
									{dimsMm?.x ? dimsMm.x.toFixed(2) : '-'}
								</div>
								<div>
									<span class="text-subtle-2">Y</span>
									{dimsMm?.y ? dimsMm.y.toFixed(2) : '-'}
								</div>
								<div>
									<span class="text-subtle-2">Z</span>
									{dimsMm?.z ? dimsMm.z.toFixed(2) : '-'}
								</div>
							</div>
						</div>
					{:else if object.geometry.geometryType.case === 'capsule'}
						{@const { value } = object.geometry.geometryType}
						<div>
							<strong class="font-semibold">dimensions (capsule)</strong>
							<div class="flex gap-3">
								<div>
									<span class="text-subtle-2">R</span>
									{value.radiusMm ? value.radiusMm.toFixed(2) : '-'}
								</div>
								<div>
									<span class="text-subtle-2">L</span>
									{value.lengthMm ? value.lengthMm.toFixed(2) : '-'}
								</div>
							</div>
						</div>
					{:else if object.geometry.geometryType.case === 'sphere'}
						<div class="flex justify-between">
							<div>
								<strong class="font-semibold">dimensions (sphere)</strong>
								<div class="flex gap-3">
									<div>
										<span class="text-subtle-2">R</span>
										{object.geometry.geometryType.value.radiusMm.toFixed(2)}
									</div>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</WeblabActive>
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
