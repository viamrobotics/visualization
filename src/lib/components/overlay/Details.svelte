<script
	module
	lang="ts"
>
	import { BufferAttribute, MathUtils, Quaternion, Vector3 } from 'three'

	import { OrientationVector } from '$lib/three/OrientationVector'

	const vec3 = new Vector3()
	const quaternion = new Quaternion()
	const ov = new OrientationVector()
</script>

<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { draggable } from '@neodrag/svelte'
	import { isInstanceOf, useTask } from '@threlte/core'
	import { Button, Icon, Input, Select, Tooltip } from '@viamrobotics/prime-core'
	import { Check, Copy } from 'lucide-svelte'

	import AddRelationship from '$lib/components/overlay/AddRelationship.svelte'
	import { relations, traits, useTrait, useWorld } from '$lib/ecs'
	import { FrameConfigUpdater } from '$lib/FrameConfigUpdater.svelte'
	import { useConfigFrames } from '$lib/hooks/useConfigFrames.svelte'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'
	import { useDrawService } from '$lib/hooks/useDrawService.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useLinkedEntities } from '$lib/hooks/useLinked.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { useResourceByName } from '$lib/hooks/useResourceByName.svelte'
	import {
		useFocusedEntity,
		useFocusedObject3d,
		useSelectedEntity,
		useSelectedObject3d,
	} from '$lib/hooks/useSelection.svelte'
	import { createPose } from '$lib/transform'

	interface Props {
		details?: Snippet<[{ entity: Entity }]>
	}

	const { details }: Props = $props()

	const world = useWorld()
	const drawService = useDrawService()
	const controls = useCameraControls()
	const resourceByName = useResourceByName()
	const configFrames = useConfigFrames()
	const partConfig = usePartConfig()
	const selectedEntity = useSelectedEntity()
	const selectedObject3d = useSelectedObject3d()
	const environment = useEnvironment()
	const focusedEntity = useFocusedEntity()
	const focusedObject3d = useFocusedObject3d()
	const entity = $derived(focusedEntity.current ?? selectedEntity.current)
	const object3d = $derived(focusedObject3d.current ?? selectedObject3d.current)
	const worldPosition = $state({ x: 0, y: 0, z: 0 })
	const worldOrientation = $state({ x: 0, y: 0, z: 1, th: 0 })
	const linkedEntities = useLinkedEntities()
	const name = useTrait(() => entity, traits.Name)
	const parent = useTrait(() => entity, traits.Parent)
	const localPose = useTrait(() => entity, traits.EditedPose)
	const box = useTrait(() => entity, traits.Box)
	const sphere = useTrait(() => entity, traits.Sphere)
	const capsule = useTrait(() => entity, traits.Capsule)
	const removable = useTrait(() => entity, traits.Removable)
	const points = useTrait(() => entity, traits.Points)
	const arrows = useTrait(() => entity, traits.Arrows)

	const framesAPI = useTrait(() => entity, traits.FramesAPI)
	const isFrameNode = $derived(!!framesAPI.current)

	const showEditFrameOptions = $derived(isFrameNode && partConfig.hasEditPermissions)
	const showRelationshipOptions = $derived(points.current || arrows.current)

	const resourceName = $derived(name.current ? resourceByName.current[name.current] : undefined)

	let geometryType = $derived.by<'box' | 'sphere' | 'capsule' | 'none'>(() => {
		if (box.current) return 'box'
		if (sphere.current) return 'sphere'
		if (capsule.current) return 'capsule'
		return 'none'
	})

	let copied = $state(false)

	let dragElement = $state.raw<HTMLElement>()

	const detailConfigUpdater = new FrameConfigUpdater(partConfig.updateFrame, partConfig.deleteFrame)

	const setGeometryType = (type: 'none' | 'box' | 'sphere' | 'capsule') => {
		if (type === geometryType) {
			return
		}

		geometryType = type

		if (entity) {
			detailConfigUpdater.setGeometryType(entity, type)
		}
	}

	useTask(
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
			autoInvalidate: false,
			running: () => object3d !== undefined,
		}
	)

	$effect(() => {
		if (entity) {
			const worldPose = createPose({
				x: worldPosition.x,
				y: worldPosition.y,
				z: worldPosition.z,
				oX: worldOrientation.x,
				oY: worldOrientation.y,
				oZ: worldOrientation.z,
				theta: MathUtils.radToDeg(worldOrientation.th),
			})
			if (entity.has(traits.WorldPose)) {
				entity.set(traits.WorldPose, worldPose)
			} else {
				entity.add(traits.WorldPose(worldPose))
			}
		}
	})

	const getCopyClipboardText = () => {
		return JSON.stringify(
			{
				worldPosition: worldPosition,
				worldOrientation: worldOrientation,
				localPosition: {
					x: localPose.current?.x,
					y: localPose.current?.y,
					z: localPose.current?.z,
				},
				localOrientation: {
					x: localPose.current?.oX,
					y: localPose.current?.oY,
					z: localPose.current?.oZ,
					th: localPose.current?.theta,
				},
				geometry: {
					type: geometryType,
					value: box.current ?? capsule.current ?? sphere.current,
				},
				parentFrame: parent.current ?? 'world',
			},
			null,
			2
		)
	}

	const isIntermediateInput = (input: string) => {
		if (input === '0') return false

		return (
			input.startsWith('0') ||
			input.startsWith('.') ||
			input.startsWith('-0') ||
			input.startsWith('-.') ||
			(input.includes('.') && input.endsWith('0')) ||
			input.endsWith('.')
		)
	}
</script>

{#snippet ImmutableField({
	label,
	value,
	ariaLabel,
}: {
	label?: string
	value?: number | string
	ariaLabel: string
})}
	<div>
		<span
			class="text-subtle-2"
			aria-label={`immutable ${ariaLabel}`}
		>
			{label}
		</span>

		{typeof value === 'number' ? value.toFixed(2) : (value ?? '-')}
	</div>
{/snippet}

{#snippet MutableField({
	label,
	value,
	ariaLabel,
	onInput,
}: {
	label: string
	value?: number
	ariaLabel: string
	onInput: (value: string) => void
})}
	<div class="flex items-center gap-1">
		<span class="text-subtle-2">{label}</span>
		<Input
			aria-label={`mutable ${ariaLabel}`}
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

{#if entity}
	{@const ParentFrame = showEditFrameOptions ? DropDownField : ImmutableField}
	{@const ScalarAttribute = showEditFrameOptions ? MutableField : ImmutableField}

	<div
		id="details-panel"
		class="border-medium bg-extralight absolute top-0 right-0 z-4 m-2 {showEditFrameOptions
			? 'w-80'
			: 'w-60'} border p-2 text-xs dark:text-black"
		use:draggable={{
			bounds: 'body',
			handle: dragElement,
		}}
	>
		<div
			class="flex cursor-move items-center justify-between gap-2 pb-2"
			bind:this={dragElement}
		>
			<div class="flex w-[90%] items-center gap-1">
				<strong class="overflow-hidden text-nowrap text-ellipsis">{name.current}</strong>
				<span class="text-subtle-2">{resourceName?.subtype}</span>
			</div>

			{#if object3d}
				<Tooltip
					let:tooltipID
					location="bottom"
				>
					<button
						class="text-subtle-2"
						aria-describedby={tooltipID}
						onclick={() => {
							const padding = 0.4

							if (!controls.current) return

							const { azimuthAngle, polarAngle } = controls.current

							controls.current.fitToBox(object3d, true, {
								paddingTop: padding,
								paddingBottom: padding,
								paddingLeft: padding,
								paddingRight: padding,
							})

							// Preserve previous rotation
							controls.current?.rotateAzimuthTo(azimuthAngle, true)
							controls.current?.rotatePolarTo(polarAngle, true)
						}}
					>
						<Icon name="image-filter-center-focus" />
					</button>
					<p slot="description">Zoom to object</p>
				</Tooltip>
			{/if}

			{#if removable.current}
				<Tooltip
					let:tooltipID
					location="bottom"
				>
					<button
						class="text-subtle-2"
						aria-describedby={tooltipID}
						onclick={() => {
							if (world.has(entity)) {
								entity.destroy()
							}
						}}
					>
						<Icon name="trash-can-outline" />
					</button>
					<p slot="description">Remove from scene</p>
				</Tooltip>
			{/if}
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
				<span class="text-subtle-2">(mm)</span>

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
				<div class="mt-0.5 flex gap-3">
					{@render ParentFrame({
						ariaLabel: 'parent frame name',
						value: parent.current ?? 'world',
						options: configFrames.getParentFrameOptions(name.current ?? ''),
						onChange: (value) => {
							if (value === parent.current) return
							traits.setParentTrait(entity, value)
							detailConfigUpdater.setFrameParent(entity, value)
						},
					})}
				</div>
			</div>

			{#if localPose.current}
				<div>
					<strong class="font-semibold">local position</strong>
					<span class="text-subtle-2">(mm)</span>

					<div class="mt-0.5 flex gap-3">
						{@render ScalarAttribute({
							label: 'x',
							ariaLabel: 'local position x coordinate',
							value: localPose.current.x,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateLocalPosition(entity, { x: Number.parseFloat(value) })
							},
						})}
						{@render ScalarAttribute({
							label: 'y',
							ariaLabel: 'local position y coordinate',
							value: localPose.current.y,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateLocalPosition(entity, { y: Number.parseFloat(value) })
							},
						})}
						{@render ScalarAttribute({
							label: 'z',
							ariaLabel: 'local position z coordinate',
							value: localPose.current.z,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateLocalPosition(entity, { z: Number.parseFloat(value) })
							},
						})}
					</div>
				</div>

				<div>
					<strong class="font-semibold">local orientation</strong>
					<span class="text-subtle-2">(deg)</span>
					<div class="flex {showEditFrameOptions ? 'gap-2' : 'gap-3'} mt-0.5">
						{@render ScalarAttribute({
							label: 'x',
							ariaLabel: 'local orientation x coordinate',
							value: localPose.current?.oX,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateLocalOrientation(entity, { oX: Number.parseFloat(value) })
							},
						})}
						{@render ScalarAttribute({
							label: 'y',
							ariaLabel: 'local orientation y coordinate',
							value: localPose.current?.oY,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateLocalOrientation(entity, { oY: Number.parseFloat(value) })
							},
						})}
						{@render ScalarAttribute({
							label: 'z',
							ariaLabel: 'local orientation z coordinate',
							value: localPose.current?.oZ,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateLocalOrientation(entity, { oZ: Number.parseFloat(value) })
							},
						})}
						{@render ScalarAttribute({
							label: 'th',
							ariaLabel: 'local orientation theta degrees',
							value: localPose.current?.theta,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateLocalOrientation(entity, {
									theta: Number.parseFloat(value),
								})
							},
						})}
					</div>
				</div>
			{/if}

			{#if showEditFrameOptions}
				<div>
					<strong class="font-semibold">geometry</strong>
					<div class="mt-0.5 grid grid-cols-4 gap-1">
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

			{#if box.current}
				<div>
					<strong class="font-semibold"> dimensions </strong>
					<span class="text-subtle-2">(box) (mm)</span>
					<div class="mt-0.5 flex items-center gap-2">
						{@render ScalarAttribute({
							label: 'x',
							ariaLabel: 'box dimensions x value input',
							value: box.current.x,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateGeometry(entity, {
									type: 'box',
									x: Number.parseFloat(value),
								})
							},
						})}
						{@render ScalarAttribute({
							label: 'y',
							ariaLabel: 'box dimensions y value input',
							value: box.current.y,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateGeometry(entity, {
									type: 'box',
									y: Number.parseFloat(value),
								})
							},
						})}
						{@render ScalarAttribute({
							label: 'z',
							ariaLabel: 'box dimensions z value input',
							value: box.current.z,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateGeometry(entity, {
									type: 'box',
									z: Number.parseFloat(value),
								})
							},
						})}
					</div>
				</div>
			{:else if capsule.current}
				<div>
					<strong class="font-semibold">dimensions</strong>
					<span class="text-subtle-2">(capsule) (mm)</span>
					<div class="mt-0.5 flex items-center gap-2">
						{@render ScalarAttribute({
							label: 'r',
							ariaLabel: 'capsule dimensions radius value input',
							value: capsule.current.r,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateGeometry(entity, {
									type: 'capsule',
									r: Number.parseFloat(value),
								})
							},
						})}
						{@render ScalarAttribute({
							label: 'l',
							ariaLabel: 'capsule dimensions length value input',
							value: capsule.current.l,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateGeometry(entity, {
									type: 'capsule',
									l: Number.parseFloat(value),
								})
							},
						})}
					</div>
				</div>
			{:else if sphere.current}
				<div>
					<strong class="font-semibold">dimensions (sphere)</strong>
					<div class="flex items-center gap-2">
						{@render ScalarAttribute({
							label: 'r',
							ariaLabel: 'sphere dimensions radius value',
							value: sphere.current.r,
							onInput: (value) => {
								if (isIntermediateInput(value)) return
								detailConfigUpdater.updateGeometry(entity, {
									type: 'sphere',
									r: Number.parseFloat(value),
								})
							},
						})}
					</div>
				</div>
			{/if}

			{#if isInstanceOf(object3d, 'Points')}
				<div>
					<strong class="font-semibold">points</strong>
					{@render ImmutableField({
						label: 'count',
						ariaLabel: 'points count',
						value: new Intl.NumberFormat().format(
							(object3d.geometry.getAttribute('position') as BufferAttribute).array.length / 3
						),
					})}
				</div>
			{/if}
		</div>

		{#if linkedEntities.current.length > 0}
			<h3 class="text-subtle-2 pt-3 pb-2">Relationships</h3>

			<div>
				<div class="mt-0.5 flex flex-col gap-1">
					<strong class="font-semibold">Linked entities</strong>
					{#each linkedEntities.current as linkedEntity (linkedEntity)}
						{@const linkedEntityName = linkedEntity.get(traits.Name)}
						{@const linkType = entity.get(relations.SubEntityLink(linkedEntity))?.type}
						<div class="flex items-center gap-1">
							<span class="text-primary">{linkedEntityName} ({linkType})</span>
							<Icon
								name="trash-can-outline"
								class="h-6 cursor-pointer px-2 py-1 text-xs text-red-500"
								onclick={() => {
									const sourceUuid = entity.get(traits.UUID)
									const targetUuid = linkedEntity.get(traits.UUID)
									if (sourceUuid && targetUuid) {
										void drawService.deleteRelationship(sourceUuid, targetUuid)
									} else {
										entity.remove(relations.SubEntityLink(linkedEntity))
									}
								}}
							/>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{@render details?.({ entity })}

		<h3 class="text-subtle-2 pt-3 pb-2">Actions</h3>

		{#if focusedEntity.current}
			<Button
				class="w-full"
				icon="arrow-left"
				variant="dark"
				onclick={() => focusedEntity.set()}
			>
				Exit object view
			</Button>
		{:else}
			<Button
				class="w-full"
				icon="image-filter-center-focus"
				onclick={() => focusedEntity.set(entity)}
			>
				Enter object view
			</Button>
		{/if}

		{#if showRelationshipOptions}
			<AddRelationship {entity} />
		{/if}

		{#if showEditFrameOptions && environment.current.isStandalone}
			<Button
				variant="danger"
				class="mt-2 w-full"
				onclick={() => detailConfigUpdater.deleteFrame(entity)}
			>
				Delete frame
			</Button>
		{/if}
	</div>
{/if}
