<script
	module
	lang="ts"
>
	import { ThemeUtils } from 'svelte-tweakpane-ui'
	import { BufferAttribute, Euler, MathUtils, Quaternion, Vector3 } from 'three'

	import { OrientationVector } from '$lib/three/OrientationVector'

	const vec3 = new Vector3()
	const quaternion = new Quaternion()
	const ov = new OrientationVector()
	const euler = new Euler()

	ThemeUtils.setGlobalDefaultTheme({
		...ThemeUtils.presets.light,
		baseBackgroundColor: '#fbfbfc',
		baseShadowColor: 'transparent',
	})
</script>

<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { draggable } from '@neodrag/svelte'
	import { isInstanceOf, useTask } from '@threlte/core'
	import { Button, Icon, Tooltip } from '@viamrobotics/prime-core'
	import { Check, Copy } from 'lucide-svelte'
	import {
		List,
		Point,
		RotationEuler,
		Slider,
		TabGroup,
		TabPage,
		type ListChangeEvent,
		type PointChangeEvent,
		type PointValue3dObject,
		type PointValue4dObject,
		type RotationEulerChangeEvent,
		type RotationEulerValueObject,
		type SliderChangeEvent,
	} from 'svelte-tweakpane-ui'

	import AddRelationship from '$lib/components/overlay/AddRelationship.svelte'
	import { relations, traits, useTrait, useWorld } from '$lib/ecs'
	import { FrameConfigUpdater } from '$lib/FrameConfigUpdater.svelte'
	import { useConfigFrames } from '$lib/hooks/useConfigFrames.svelte'
	import { useCameraControls } from '$lib/hooks/useControls.svelte'
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

	const geometryTypes = ['none', 'box', 'sphere', 'capsule'] as const
	let geometryTabIndex = $state(0)

	$effect(() => {
		geometryTabIndex = geometryTypes.indexOf(geometryType)
	})

	$effect(() => {
		// setGeometryType guards against no-ops, so this is safe to fire on every
		// tab-index change (whether user-initiated or trait-derived).
		setGeometryType(geometryTypes[geometryTabIndex])
	})

	let copied = $state(false)

	let dragElement = $state.raw<HTMLElement>()

	const eulerValue = $derived.by<RotationEulerValueObject>(() => {
		if (!localPose.current) return { x: 0, y: 0, z: 0 }
		ov.set(
			localPose.current.oX,
			localPose.current.oY,
			localPose.current.oZ,
			MathUtils.degToRad(localPose.current.theta)
		)
		ov.toEuler(euler)
		return {
			x: MathUtils.radToDeg(euler.x),
			y: MathUtils.radToDeg(euler.y),
			z: MathUtils.radToDeg(euler.z),
		}
	})

	const formatTwoDecimals = (value: number) => value.toFixed(2)

	const detailConfigUpdater = new FrameConfigUpdater(partConfig.updateFrame, partConfig.deleteFrame)

	const handlePositionChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		const next = event.detail.value as PointValue3dObject
		detailConfigUpdater.updateLocalPosition(entity, next)
	}

	const handleOrientationOVChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		const next = event.detail.value as PointValue4dObject
		detailConfigUpdater.updateLocalOrientation(entity, {
			oX: next.x,
			oY: next.y,
			oZ: next.z,
			theta: next.w,
		})
	}

	const handleOrientationEulerChange = (event: RotationEulerChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		const next = event.detail.value as RotationEulerValueObject
		euler.set(
			MathUtils.degToRad(next.x),
			MathUtils.degToRad(next.y),
			MathUtils.degToRad(next.z),
			'ZYX'
		)
		quaternion.setFromEuler(euler)
		ov.setFromQuaternion(quaternion)
		detailConfigUpdater.updateLocalOrientation(entity, {
			oX: ov.x,
			oY: ov.y,
			oZ: ov.z,
			theta: MathUtils.radToDeg(ov.th),
		})
	}

	const handleBoxChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		const next = event.detail.value as PointValue3dObject
		detailConfigUpdater.updateGeometry(entity, {
			type: 'box',
			x: next.x,
			y: next.y,
			z: next.z,
		})
	}

	const handleSphereRChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		detailConfigUpdater.updateGeometry(entity, { type: 'sphere', r: event.detail.value })
	}

	const handleCapsuleRChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		detailConfigUpdater.updateGeometry(entity, { type: 'capsule', r: event.detail.value })
	}

	const handleCapsuleLChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		detailConfigUpdater.updateGeometry(entity, { type: 'capsule', l: event.detail.value })
	}

	const handleParentChange = (event: ListChangeEvent) => {
		if (event.detail.origin !== 'internal' || !entity) return
		const value = event.detail.value as string
		if (value === parent.current) return
		traits.setParentTrait(entity, value)
		detailConfigUpdater.setFrameParent(entity, value)
	}

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

{#if entity}
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
				{#if showEditFrameOptions}
					<div aria-label="mutable parent frame">
						<List
							options={configFrames.getParentFrameOptions(name.current ?? '') ?? []}
							value={parent.current ?? 'world'}
							on:change={handleParentChange}
						/>
					</div>
				{:else}
					<div class="mt-0.5 flex gap-3">
						{@render ImmutableField({
							ariaLabel: 'parent frame name',
							value: parent.current ?? 'world',
						})}
					</div>
				{/if}
			</div>

			{#if localPose.current}
				<div>
					<strong class="font-semibold">local position</strong>
					<span class="text-subtle-2">(mm)</span>

					{#if showEditFrameOptions}
						<div aria-label="mutable local position">
							<Point
								value={{
									x: localPose.current.x,
									y: localPose.current.y,
									z: localPose.current.z,
								}}
								format={formatTwoDecimals}
								on:change={handlePositionChange}
							/>
						</div>
					{:else}
						<div class="mt-0.5 flex gap-3">
							{@render ImmutableField({
								label: 'x',
								ariaLabel: 'local position x coordinate',
								value: localPose.current.x,
							})}
							{@render ImmutableField({
								label: 'y',
								ariaLabel: 'local position y coordinate',
								value: localPose.current.y,
							})}
							{@render ImmutableField({
								label: 'z',
								ariaLabel: 'local position z coordinate',
								value: localPose.current.z,
							})}
						</div>
					{/if}
				</div>

				<div>
					<strong class="font-semibold">local orientation</strong>

					{#if showEditFrameOptions}
						<div aria-label="mutable local orientation">
							<TabGroup>
								<TabPage title="OV (deg)">
									<Point
										value={{
											x: localPose.current.oX,
											y: localPose.current.oY,
											z: localPose.current.oZ,
											w: localPose.current.theta,
										}}
										format={formatTwoDecimals}
										on:change={handleOrientationOVChange}
									/>
								</TabPage>
								<TabPage title="Euler">
									<RotationEuler
										value={eulerValue}
										unit="deg"
										on:change={handleOrientationEulerChange}
									/>
								</TabPage>
							</TabGroup>
						</div>
					{:else}
						<div class="mt-0.5 flex gap-3">
							{@render ImmutableField({
								label: 'x',
								ariaLabel: 'local orientation x coordinate',
								value: localPose.current.oX,
							})}
							{@render ImmutableField({
								label: 'y',
								ariaLabel: 'local orientation y coordinate',
								value: localPose.current.oY,
							})}
							{@render ImmutableField({
								label: 'z',
								ariaLabel: 'local orientation z coordinate',
								value: localPose.current.oZ,
							})}
							{@render ImmutableField({
								label: 'th',
								ariaLabel: 'local orientation theta degrees',
								value: localPose.current.theta,
							})}
						</div>
					{/if}
				</div>
			{/if}

			{#if showEditFrameOptions}
				<div>
					<strong class="font-semibold">geometry</strong>
					<span class="text-subtle-2">(mm)</span>
					<div aria-label="mutable geometry">
						<TabGroup bind:selectedIndex={geometryTabIndex}>
							<TabPage title="None" />
							<TabPage title="Box">
								{#if box.current}
									<div aria-label="mutable box dimensions">
										<Point
											value={{
												x: box.current.x,
												y: box.current.y,
												z: box.current.z,
											}}
											format={formatTwoDecimals}
											on:change={handleBoxChange}
										/>
									</div>
								{/if}
							</TabPage>
							<TabPage title="Sphere">
								{#if sphere.current}
									<div aria-label="mutable sphere dimensions">
										<Slider
											label="r"
											value={sphere.current.r}
											format={formatTwoDecimals}
											on:change={handleSphereRChange}
										/>
									</div>
								{/if}
							</TabPage>
							<TabPage title="Capsule">
								{#if capsule.current}
									<div aria-label="mutable capsule dimensions">
										<Slider
											label="r"
											value={capsule.current.r}
											format={formatTwoDecimals}
											on:change={handleCapsuleRChange}
										/>
										<Slider
											label="l"
											value={capsule.current.l}
											format={formatTwoDecimals}
											on:change={handleCapsuleLChange}
										/>
									</div>
								{/if}
							</TabPage>
						</TabGroup>
					</div>
				</div>
			{:else if box.current}
				<div>
					<strong class="font-semibold">dimensions</strong>
					<span class="text-subtle-2">(box) (mm)</span>
					<div class="mt-0.5 flex items-center gap-2">
						{@render ImmutableField({
							label: 'x',
							ariaLabel: 'box dimensions x value input',
							value: box.current.x,
						})}
						{@render ImmutableField({
							label: 'y',
							ariaLabel: 'box dimensions y value input',
							value: box.current.y,
						})}
						{@render ImmutableField({
							label: 'z',
							ariaLabel: 'box dimensions z value input',
							value: box.current.z,
						})}
					</div>
				</div>
			{:else if capsule.current}
				<div>
					<strong class="font-semibold">dimensions</strong>
					<span class="text-subtle-2">(capsule) (mm)</span>
					<div class="mt-0.5 flex items-center gap-2">
						{@render ImmutableField({
							label: 'r',
							ariaLabel: 'capsule dimensions radius value input',
							value: capsule.current.r,
						})}
						{@render ImmutableField({
							label: 'l',
							ariaLabel: 'capsule dimensions length value input',
							value: capsule.current.l,
						})}
					</div>
				</div>
			{:else if sphere.current}
				<div>
					<strong class="font-semibold">dimensions (sphere)</strong>
					<div class="flex items-center gap-2">
						{@render ImmutableField({
							label: 'r',
							ariaLabel: 'sphere dimensions radius value',
							value: sphere.current.r,
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
									entity.remove(relations.SubEntityLink(linkedEntity))
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

<style>
	:global(.tp-tabv_i) {
		display: none;
	}

	:global(.tp-lblv),
	:global(.tp-tbpv_c) {
		padding-left: 0 !important;
	}
</style>
