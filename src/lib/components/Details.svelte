<script
	module
	lang="ts"
>
	import { OrientationVector } from '$lib/three/OrientationVector'
	import { Quaternion, Vector3, MathUtils } from 'three'

	const vec3 = new Vector3()
	const quaternion = new Quaternion()
	const ov = new OrientationVector()
</script>

<script lang="ts">
	import { Check, Copy } from 'lucide-svelte'
	import { useTask } from '@threlte/core'
	import { Button, Icon, Select, Input } from '@viamrobotics/prime-core'
	import {
		useSelectedObject,
		useFocusedObject,
		useFocused,
		useFocusedObject3d,
		useSelectedObject3d,
	} from '$lib/hooks/useSelection.svelte'
	import { useDraggable } from '$lib/hooks/useDraggable.svelte'
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { FrameConfigUpdater } from '$lib/FrameConfigUpdater.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'

	const { ...rest } = $props()

	const focused = useFocused()
	const focusedObject = useFocusedObject()
	const focusedObject3d = useFocusedObject3d()
	const frames = useFrames()
	const partConfig = usePartConfig()
	const selectedObject = useSelectedObject()
	const selectedObject3d = useSelectedObject3d()
	const environment = useEnvironment()
	const object = $derived(focusedObject.current ?? selectedObject.current)
	const object3d = $derived(focusedObject3d.current ?? selectedObject3d.current)
	const worldPosition = $state({ x: 0, y: 0, z: 0 })
	const worldOrientation = $state({ x: 0, y: 0, z: 1, th: 0 })
	let geometryType = $derived.by(
		() =>
			(object?.geometry?.geometryType.case as 'none' | 'box' | 'sphere' | 'capsule' | undefined) ??
			'none'
	)

	const localPose = $derived(object?.localEditedPose)
	const referenceFrame = $derived(object?.referenceFrame ?? 'world')
	const isFrameNode = $derived(
		frames.current.find((frame) => frame.name === object?.name) !== undefined
	)
	const showEditFrameOptions = $derived(isFrameNode && partConfig.hasEditPermissions)
	let copied = $state(false)

	const draggable = useDraggable('details')

	const detailConfigUpdater = new FrameConfigUpdater(
		() => object,
		partConfig.updateFrame,
		partConfig.deleteFrame,
		() => referenceFrame
	)

	const setGeometryType = (type: 'none' | 'box' | 'sphere' | 'capsule') => {
		if (type === geometryType) return
		geometryType = type
		detailConfigUpdater.setGeometryType(type)
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
		{
			autoStart: false,
			autoInvalidate: false,
		}
	)

	$effect.pre(() => {
		if (object3d) {
			start()
		} else {
			stop()
		}
	})

	const getCopyClipboardText = () => {
		return JSON.stringify(
			{
				worldPosition: worldPosition,
				worldOrientation: worldOrientation,
				localPosition: {
					x: localPose?.x,
					y: localPose?.y,
					z: localPose?.z,
				},
				localOrientation: {
					x: localPose?.oX,
					y: localPose?.oY,
					z: localPose?.oZ,
					th: localPose?.theta,
				},
				geometry: {
					type: geometryType,
					value: object?.geometry?.geometryType.value,
				},
				parentFrame: referenceFrame,
			},
			null,
			2
		)
	}
</script>

{#snippet ImmutableField({
	label,
	value,
	ariaLabel,
}: {
	label?: string
	value: string
	ariaLabel: string
})}
	<div>
		<span
			class="text-subtle-2"
			aria-label={`immutable ${ariaLabel}`}
		>
			{label}
		</span>

		{value}
	</div>
{/snippet}

{#snippet MutableField({
	label,
	value,
	ariaLabel,
	onInput,
}: {
	label: string
	value: string
	ariaLabel: string
	onInput: (value: string) => void
})}
	<div class="flex items-center gap-1">
		<span class="text-subtle-2">{label}</span>
		<Input
			type="number"
			aria-label={`mutable ${ariaLabel}`}
			class="max-w-24 min-w-0 flex-1 rounded border px-1 py-0.5 text-xs"
			{value}
			on:input={(event) => onInput((event.target as HTMLInputElement).value)}
		/>
	</div>
{/snippet}

{#snippet DropDownField({
	value,
	ariaLabel,
	options,
	onChange,
}: {
	value: string
	ariaLabel: string
	options: string[]
	onChange: (value: string) => void
})}
	<Select
		aria-label={`dropdown ${ariaLabel}`}
		{value}
		onchange={(event: InputEvent) => {
			onChange((event.target as HTMLSelectElement).value)
		}}
	>
		{#each options as option (option)}
			<option value={option}>{option}</option>
		{/each}
	</Select>
{/snippet}

{#if object}
	{@const ParentFrame = showEditFrameOptions ? DropDownField : ImmutableField}

	<div
		class="border-medium bg-extralight absolute top-0 right-0 z-1000 m-2 {showEditFrameOptions
			? 'w-80'
			: 'w-60'} border p-2 text-xs"
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

		<h3
			class="text-subtle-2 flex justify-between py-2"
			data-testid="details-header"
		>
			Details

			<button
				onclick={async () => {
					navigator.clipboard.writeText(getCopyClipboardText())
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
			<div>
				<strong class="font-semibold">world position</strong>
				<span class="text-subtle-2">(m)</span>

				<div class="flex gap-3">
					<div>
						<span class="text-subtle-2">x</span>
						{worldPosition.x.toFixed(2)}
					</div>
					<div>
						<span class="text-subtle-2">y</span>
						{worldPosition.y.toFixed(2)}
					</div>
					<div>
						<span class="text-subtle-2">z</span>
						{worldPosition.z.toFixed(2)}
					</div>
				</div>
			</div>

			<div>
				<strong class="font-semibold">world orientation</strong>
				<span class="text-subtle-2">(deg)</span>
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
						{MathUtils.radToDeg(worldOrientation.th).toFixed(2)}
					</div>
				</div>
			</div>

			<div>
				<strong class="font-semibold">parent frame</strong>
				<div class="flex gap-3">
					{@render ParentFrame({
						ariaLabel: 'parent frame name',
						value: referenceFrame,
						options: frames.getParentFrameOptions(object?.name ?? ''),
						onChange: (value) => detailConfigUpdater.setFrameParent(value),
					})}
				</div>
			</div>

			{#if localPose}
				{@const PoseAttribute = showEditFrameOptions ? MutableField : ImmutableField}
				<div>
					<strong class="font-semibold">local position</strong>
					<span class="text-subtle-2">(m)</span>

					<div class="flex gap-3">
						{@render PoseAttribute({
							label: 'x',
							ariaLabel: 'local position x coordinate',
							value: localPose.x.toFixed(2),
							onInput: (value) => detailConfigUpdater.updateLocalPosition({ x: parseFloat(value) }),
						})}
						{@render PoseAttribute({
							label: 'y',
							ariaLabel: 'local position y coordinate',
							value: localPose.y.toFixed(2),
							onInput: (value) => detailConfigUpdater.updateLocalPosition({ y: parseFloat(value) }),
						})}
						{@render PoseAttribute({
							label: 'z',
							ariaLabel: 'local position z coordinate',
							value: localPose.z.toFixed(2),
							onInput: (value) => detailConfigUpdater.updateLocalPosition({ z: parseFloat(value) }),
						})}
					</div>
				</div>

				<div>
					<strong class="font-semibold">local orientation</strong>
					<span class="text-subtle-2">(deg)</span>
					<div class="flex {showEditFrameOptions ? 'gap-2' : 'gap-3'}">
						{@render PoseAttribute({
							label: 'x',
							ariaLabel: 'local orientation x coordinate',
							value: localPose.oX.toFixed(2),
							onInput: (value) =>
								detailConfigUpdater.updateLocalOrientation({ oX: parseFloat(value) }),
						})}
						{@render PoseAttribute({
							label: 'y',
							ariaLabel: 'local orientation y coordinate',
							value: localPose.oY.toFixed(2),
							onInput: (value) =>
								detailConfigUpdater.updateLocalOrientation({ oY: parseFloat(value) }),
						})}
						{@render PoseAttribute({
							label: 'z',
							ariaLabel: 'local orientation z coordinate',
							value: localPose.oZ.toFixed(2),
							onInput: (value) =>
								detailConfigUpdater.updateLocalOrientation({ oZ: parseFloat(value) }),
						})}
						{@render PoseAttribute({
							label: 'th',
							ariaLabel: 'local orientation theta degrees',
							value: localPose.theta.toFixed(2),
							onInput: (value) =>
								detailConfigUpdater.updateLocalOrientation({ theta: parseFloat(value) }),
						})}
					</div>
				</div>
			{/if}

			{#if showEditFrameOptions}
				<div>
					<strong class="font-semibold">geometry</strong>
					<div class="grid grid-cols-4 gap-1">
						<Button
							variant={geometryType === 'none' ? 'dark' : 'primary'}
							class="h-6 px-2 py-1 text-xs"
							onclick={() => setGeometryType('none')}
						>
							None
						</Button>
						<Button
							variant={geometryType === 'box' ? 'dark' : 'primary'}
							class="h-6 px-2 py-1 text-xs"
							onclick={() => setGeometryType('box')}
						>
							Box
						</Button>
						<Button
							variant={geometryType === 'sphere' ? 'dark' : 'primary'}
							class="h-6 px-2 py-1 text-xs"
							onclick={() => setGeometryType('sphere')}
						>
							Sphere
						</Button>
						<Button
							variant={geometryType === 'capsule' ? 'dark' : 'primary'}
							class="h-6 px-2 py-1 text-xs"
							onclick={() => setGeometryType('capsule')}
						>
							Capsule
						</Button>
					</div>
				</div>
			{/if}
			{#if geometryType !== 'none'}
				{@const GeometryAttribute = showEditFrameOptions ? MutableField : ImmutableField}
				{#if geometryType === 'box'}
					{@const { dimsMm } = object?.geometry?.geometryType.value as {
						dimsMm: { x: number; y: number; z: number }
					}}
					<div>
						<strong class="font-semibold"> dimensions </strong>
						<span class="text-subtle-2">(box)</span>
						<div class="flex items-center gap-2">
							{@render GeometryAttribute({
								label: 'x',
								ariaLabel: 'box dimensions x value input',
								value: dimsMm?.x ? dimsMm.x.toFixed(2) : '-',
								onInput: (value) =>
									detailConfigUpdater.updateGeometry({ type: 'box', x: parseFloat(value) }),
							})}
							{@render GeometryAttribute({
								label: 'y',
								ariaLabel: 'box dimensions y value input',
								value: dimsMm?.y ? dimsMm.y.toFixed(2) : '-',
								onInput: (value) =>
									detailConfigUpdater.updateGeometry({ type: 'box', y: parseFloat(value) }),
							})}
							{@render GeometryAttribute({
								label: 'z',
								ariaLabel: 'box dimensions z value input',
								value: dimsMm?.z ? dimsMm.z.toFixed(2) : '-',
								onInput: (value) =>
									detailConfigUpdater.updateGeometry({ type: 'box', z: parseFloat(value) }),
							})}
						</div>
					</div>
				{/if}
				{#if geometryType === 'capsule'}
					{@const { radiusMm, lengthMm } = object?.geometry?.geometryType.value as {
						radiusMm: number
						lengthMm: number
					}}
					<div>
						<strong class="font-semibold">dimensions</strong>
						<span class="text-subtle-2">(capsule)</span>
						<div class="flex items-center gap-2">
							{@render GeometryAttribute({
								label: 'r',
								ariaLabel: 'capsule dimensions radius value input',
								value: radiusMm ? radiusMm.toFixed(2) : '-',
								onInput: (value) =>
									detailConfigUpdater.updateGeometry({ type: 'capsule', r: parseFloat(value) }),
							})}
							{@render GeometryAttribute({
								label: 'l',
								ariaLabel: 'capsule dimensions length value input',
								value: lengthMm ? lengthMm.toFixed(2) : '-',
								onInput: (value) =>
									detailConfigUpdater.updateGeometry({ type: 'capsule', l: parseFloat(value) }),
							})}
						</div>
					</div>
				{/if}
				{#if geometryType === 'sphere'}
					{@const { radiusMm } = object?.geometry?.geometryType.value as { radiusMm: number }}
					<div>
						<strong class="font-semibold">dimensions</strong>
						<span class="text-subtle-2">(sphere)</span>
						<div class="flex items-center gap-2">
							{@render GeometryAttribute({
								label: 'r',
								ariaLabel: 'sphere dimensions radius value',
								value: radiusMm ? radiusMm.toFixed(2) : '-',
								onInput: (value) =>
									detailConfigUpdater.updateGeometry({ type: 'sphere', r: parseFloat(value) }),
							})}
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

		{#if showEditFrameOptions && environment.current.isStandalone}
			<Button
				variant="danger"
				class="mt-2 w-full"
				onclick={() => detailConfigUpdater.deleteFrame()}>Delete frame</Button
			>
		{/if}
	</div>
{/if}
