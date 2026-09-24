<script
	module
	lang="ts"
>
	import { Euler, MathUtils, Quaternion } from 'three'

	import { OrientationVector } from '$lib/math/OrientationVector'

	const quaternionUtil = new Quaternion()
	const ovUtil = new OrientationVector()
	const eulerUtil = new Euler()
</script>

<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import {
		List,
		type ListChangeEvent,
		Point,
		type PointChangeEvent,
		type PointValue3dObject,
		type PointValue4dObject,
		RotationEuler,
		type RotationEulerChangeEvent,
		type RotationEulerValueObject,
		TabGroup,
		TabPage,
	} from 'svelte-tweakpane-ui'

	import { relations, traits, useParentName, useTarget, useTrait } from '$lib/ecs'
	import { FrameEditor } from '$lib/editing/FrameEditor'
	import { useParentFrameOptions } from '$lib/hooks/useParentFrameOptions.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { Pose } from '$lib/math'

	import EntityLink from '../EntityLink.svelte'

	interface Props {
		entity: Entity
		/** When false, poses render as read-only text instead of editable controls. */
		editable: boolean
	}

	const { entity, editable }: Props = $props()

	const { invalidate } = useThrelte()
	const partConfig = usePartConfig()

	const frameEditor = new FrameEditor(partConfig.updateFrame, partConfig.deleteFrame)

	const name = useTrait(() => entity, traits.Name)
	const matrix = useTrait(() => entity, traits.Matrix)
	const editedMatrix = useTrait(() => entity, traits.EditedMatrix)
	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const center = useTrait(() => entity, traits.Center)
	const parent = useParentName(() => entity)
	// Undefined at the world root, and while an `Orphan` waits for its frame to
	// appear — in both cases there is nothing to select, so no link is offered.
	const parentEntity = useTarget(() => entity, relations.ChildOf)
	const parentOptions = useParentFrameOptions(() => name.current)

	const localPose = $derived.by<Pose | undefined>(() => {
		const source = editedMatrix.current ?? matrix.current

		if (source) return new Pose().setFromMatrix4(source)
		if (center.current) return new Pose().copy(center.current)
		return undefined
	})

	const worldPose = $derived.by<Pose | undefined>(() => {
		if (!worldMatrix.current) return
		return new Pose().setFromMatrix4(worldMatrix.current)
	})

	const eulerValue = $derived.by<RotationEulerValueObject>(() => {
		if (!localPose) return { x: 0, y: 0, z: 0 }
		ovUtil.set(localPose.oX, localPose.oY, localPose.oZ, MathUtils.degToRad(localPose.theta))
		ovUtil.toEuler(eulerUtil)
		return {
			x: MathUtils.radToDeg(eulerUtil.x),
			y: MathUtils.radToDeg(eulerUtil.y),
			z: MathUtils.radToDeg(eulerUtil.z),
		}
	})

	/**
	 * The `<List>`'s bound value must be one of its options, or the native select
	 * snaps to selectedIndex -1 and renders blank. `useParentFrameOptions` can lag
	 * `parent.current`, such as an unresolved orphan or frames that have not loaded
	 * yet. Always include the current parent so the field shows it. That is
	 * cycle-safe, since the current parent is neither self nor a descendant.
	 */
	const parentFrameOptions = $derived.by(() => {
		const value = parent.current ?? 'world'
		const options = parentOptions.current
		return options.includes(value) ? options : [value, ...options]
	})

	const handleParentChange = (event: ListChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const value = event.detail.value as string
		if (value === parent.current) return
		frameEditor.setParent(entity, value)
		invalidate()
	}

	const handlePositionChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as PointValue3dObject
		frameEditor.setPose(entity, next)
		invalidate()
	}

	const handleOrientationOVChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as PointValue4dObject
		frameEditor.setPose(entity, {
			oX: next.x,
			oY: next.y,
			oZ: next.z,
			theta: next.w,
		})
		invalidate()
	}

	const handleOrientationEulerChange = (event: RotationEulerChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as RotationEulerValueObject
		eulerUtil.set(
			MathUtils.degToRad(next.x),
			MathUtils.degToRad(next.y),
			MathUtils.degToRad(next.z),
			'ZYX'
		)
		quaternionUtil.setFromEuler(eulerUtil)
		ovUtil.setFromQuaternion(quaternionUtil)
		frameEditor.setPose(entity, {
			oX: ovUtil.x,
			oY: ovUtil.y,
			oZ: ovUtil.z,
			theta: MathUtils.radToDeg(ovUtil.th),
		})
		invalidate()
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

<div>
	<strong class="font-semibold">world position</strong>
	<span class="text-subtle-2">(mm)</span>

	<div class="flex gap-3">
		<div>
			<span class="text-subtle-2">x</span>
			{(worldPose?.x ?? 0).toFixed(2)}
		</div>
		<div>
			<span class="text-subtle-2">y</span>
			{(worldPose?.y ?? 0).toFixed(2)}
		</div>
		<div>
			<span class="text-subtle-2">z</span>
			{(worldPose?.z ?? 0).toFixed(2)}
		</div>
	</div>
</div>

<div>
	<strong class="font-semibold">world orientation</strong>
	<span class="text-subtle-2">(deg)</span>
	<div class="flex gap-3">
		<div>
			<span class="text-subtle-2">x</span>
			{(worldPose?.oX ?? 0).toFixed(2)}
		</div>
		<div>
			<span class="text-subtle-2">y</span>
			{(worldPose?.oY ?? 0).toFixed(2)}
		</div>
		<div>
			<span class="text-subtle-2">z</span>
			{(worldPose?.oZ ?? 0).toFixed(2)}
		</div>
		<div>
			<span class="text-subtle-2">th</span>
			{(worldPose?.theta ?? 0).toFixed(2)}
		</div>
	</div>
</div>

<div>
	<strong class="font-semibold">parent frame</strong>
	{#if editable}
		{#if parentEntity.current}
			<span class="text-subtle-2">
				— <EntityLink entity={parentEntity.current} />
			</span>
		{/if}
		<!--
			Remount on entity change. svelte-tweakpane-ui's List runs
			`listBlade.value = value` on the still-mounted blade before its
			`options` prop has propagated, so the new entity's parent name
			(absent from the previous entity's option set) hits Tweakpane's
			ListConstraint, snaps to the first option, and fires a change
			event that handleParentChange interprets as a user pick — silently
			reparenting the clicked frame.
		-->
		{#key entity}
			<div aria-label="mutable parent frame">
				<List
					options={parentFrameOptions}
					value={parent.current ?? 'world'}
					on:change={handleParentChange}
				/>
			</div>
		{/key}
	{:else}
		<div class="mt-0.5 flex gap-3">
			{#if parentEntity.current}
				<EntityLink entity={parentEntity.current} />
			{:else}
				{@render ImmutableField({
					ariaLabel: 'parent frame name',
					value: parent.current ?? 'world',
				})}
			{/if}
		</div>
	{/if}
</div>

{#if localPose}
	<div>
		<strong class="font-semibold">local position</strong>
		<span class="text-subtle-2">(mm)</span>

		{#if editable}
			<div aria-label="mutable local position">
				<Point
					value={{
						x: localPose.x,
						y: localPose.y,
						z: localPose.z,
					}}
					on:change={handlePositionChange}
				/>
			</div>
		{:else}
			<div class="mt-0.5 flex gap-3">
				{@render ImmutableField({
					label: 'x',
					ariaLabel: 'local position x coordinate',
					value: localPose.x,
				})}
				{@render ImmutableField({
					label: 'y',
					ariaLabel: 'local position y coordinate',
					value: localPose.y,
				})}
				{@render ImmutableField({
					label: 'z',
					ariaLabel: 'local position z coordinate',
					value: localPose.z,
				})}
			</div>
		{/if}
	</div>

	<div>
		<strong class="font-semibold">local orientation</strong>

		{#if editable}
			<div aria-label="mutable local orientation">
				<TabGroup>
					<TabPage title="OV (deg)">
						<Point
							value={{
								x: localPose.oX,
								y: localPose.oY,
								z: localPose.oZ,
								w: localPose.theta,
							}}
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
					value: localPose.oX,
				})}
				{@render ImmutableField({
					label: 'y',
					ariaLabel: 'local orientation y coordinate',
					value: localPose.oY,
				})}
				{@render ImmutableField({
					label: 'z',
					ariaLabel: 'local orientation z coordinate',
					value: localPose.oZ,
				})}
				{@render ImmutableField({
					label: 'th',
					ariaLabel: 'local orientation theta degrees',
					value: localPose.theta,
				})}
			</div>
		{/if}
	</div>
{/if}
