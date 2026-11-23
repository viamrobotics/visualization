<script
	module
	lang="ts"
>
	import { Euler, MathUtils, Quaternion } from 'three'

	import { OrientationVector } from '#lib/math/OrientationVector.js'

	const quaternionUtil = new Quaternion()
	const ovUtil = new OrientationVector()
	const eulerUtil = new Euler()
</script>

<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'
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

	import { relations, traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { FrameEditor } from '#lib/editing/FrameEditor.js'
	import { useParentFrameOptions } from '#lib/hooks/useParentFrameOptions.svelte.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { Pose } from '#lib/math/index.js'

	import EntityLink from '../EntityLink.svelte'
	import { composeDisplayedPose } from './composeDisplayedPose'
	import {
		MIXED_POSE,
		orientationEuler,
		sharedEuler,
		type SharedPose,
		sharedPose,
	} from './sharedPose'
	import {
		changedAxes,
		formatInputNumber,
		formatSharedNumber,
		MIXED,
		MIXED_TEXT,
		type Shared,
		sharedValue,
		toInputNumber,
	} from './sharedValue'
	import WorldPoseDetails from './WorldPoseDetails.svelte'

	interface Props {
		/** The selection. Never empty. */
		entities: readonly Entity[]
		/** When false, poses render as read-only text instead of editable controls. */
		editable: boolean
	}

	const { entities, editable }: Props = $props()

	const { invalidate } = useThrelte()
	const partConfig = usePartConfig()

	const frameEditor = new FrameEditor(partConfig.updateFrame, partConfig.deleteFrame)

	const reads = useMappedEntitiesTraits(
		() => entities,
		[
			traits.Name,
			traits.Matrix,
			traits.EditedMatrix,
			traits.WorldMatrix,
			traits.Center,
			traits.FramesAPI,
			traits.Orphan,
			relations.ChildOf,
		],
		(entity) => {
			// A frame's displayed pose is its origin. Other entities fold their geometry center in.
			const center = entity.has(traits.FramesAPI) ? undefined : entity.get(traits.Center)
			const worldMatrix = entity.get(traits.WorldMatrix)
			const parent = entity.targetFor(relations.ChildOf)

			return {
				name: entity.get(traits.Name),
				// An entity with neither a transform nor a center renders at the origin, so that is its pose.
				localPose:
					composeDisplayedPose(
						entity.get(traits.EditedMatrix) ?? entity.get(traits.Matrix),
						center
					) ?? new Pose(),
				worldPose: worldMatrix ? composeDisplayedPose(worldMatrix, center) : undefined,
				// Undefined at the world root, and while an `Orphan` waits for its frame to appear.
				parent: parent?.isAlive() ? parent : undefined,
				orphan: entity.get(traits.Orphan) || undefined,
			}
		}
	)

	// A parent's own rename changes what shows, so parents are read on their own.
	const parentEntities = $derived([
		...new Set(reads.current.flatMap((read) => (read.parent ? [read.parent] : []))),
	])
	const parentEntityNames = useMappedEntitiesTraits(
		() => parentEntities,
		[traits.Name],
		(parent) => parent.get(traits.Name)
	)
	const nameOfParent = $derived(
		new Map(parentEntities.map((parent, index) => [parent, parentEntityNames.current[index]]))
	)

	const parentNames = $derived(
		reads.current.map(
			(read) => (read.parent ? nameOfParent.get(read.parent) : undefined) || read.orphan || 'world'
		)
	)
	const parentName = $derived(sharedValue(parentNames))
	const parentEntity = $derived(sharedValue(reads.current.map((read) => read.parent)))

	const parentOptions = useParentFrameOptions(() => reads.current.map((read) => read.name))

	const localPoses = $derived(reads.current.map((read) => read.localPose))
	const localPose = $derived(sharedPose(localPoses))
	const worldPoses = $derived(reads.current.map((read) => read.worldPose))
	const definedWorldPoses = $derived(worldPoses.filter((pose) => pose !== undefined))
	// An entity whose world transform hasn't resolved, such as an orphan, isn't drawn at the
	// origin, so it has no world pose to share. One alone keeps reading as the origin.
	const worldPose = $derived.by((): SharedPose | undefined => {
		if (definedWorldPoses.length === 0) return undefined
		if (definedWorldPoses.length < worldPoses.length) return MIXED_POSE
		return sharedPose(definedWorldPoses)
	})
	const eulerValue = $derived(sharedEuler(localPoses))
	const isEulerMixed = $derived(Object.values(eulerValue).includes(MIXED))

	const shownPosition = $derived({
		x: toInputNumber(localPose.x),
		y: toInputNumber(localPose.y),
		z: toInputNumber(localPose.z),
	})
	const shownOrientation = $derived({
		x: toInputNumber(localPose.oX),
		y: toInputNumber(localPose.oY),
		z: toInputNumber(localPose.oZ),
		w: toInputNumber(localPose.theta),
	})
	const shownEuler = $derived({
		x: toInputNumber(eulerValue.x),
		y: toInputNumber(eulerValue.y),
		z: toInputNumber(eulerValue.z),
	})

	/**
	 * The `<List>`'s bound value must be one of its options, or the native select
	 * snaps to selectedIndex -1 and renders blank. `useParentFrameOptions` can lag
	 * the current parent, such as an unresolved orphan or frames that have not loaded
	 * yet. Always include what the field shows, so it renders. A shared current
	 * parent is cycle-safe, since it is neither self nor a descendant of any of them.
	 */
	const parentFrameOptions = $derived.by(() => {
		const value = parentName === MIXED ? MIXED_TEXT : parentName
		const options = parentOptions.current
		return options.includes(value) ? options : [value, ...options]
	})

	// Remounts the parent `<List>` when the selection changes. See the markup for why.
	const selectionKey = $derived(entities.join(','))

	const handleParentChange = (event: ListChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const value = event.detail.value as string
		if (value === MIXED_TEXT) return

		for (const [index, entity] of entities.entries()) {
			if (parentNames[index] !== value) frameEditor.setParent(entity, value)
		}
		invalidate()
	}

	const handlePositionChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const patch = changedAxes(shownPosition, event.detail.value as PointValue3dObject)
		if (Object.keys(patch).length === 0) return

		for (const entity of entities) frameEditor.setPose(entity, patch)
		invalidate()
	}

	const handleOrientationOVChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const { x, y, z, w } = changedAxes(shownOrientation, event.detail.value as PointValue4dObject)
		const patch = { oX: x, oY: y, oZ: z, theta: w }
		if (Object.values(patch).every((value) => value === undefined)) return

		for (const entity of entities) frameEditor.setPose(entity, patch)
		invalidate()
	}

	/**
	 * Writes the edited Euler angles into each entity's own orientation. An angle left
	 * alone keeps each entity's own value, so the rotation is rebuilt per entity.
	 */
	const writeEuler = (next: PointValue3dObject | RotationEulerValueObject) => {
		const patch = changedAxes(shownEuler, { x: next.x, y: next.y, z: next.z })
		if (Object.keys(patch).length === 0) return

		for (const [index, entity] of entities.entries()) {
			const pose = localPoses[index]
			if (!pose) continue

			const angles = { ...orientationEuler(pose), ...patch }
			eulerUtil.set(
				MathUtils.degToRad(angles.x),
				MathUtils.degToRad(angles.y),
				MathUtils.degToRad(angles.z),
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
		}
		invalidate()
	}

	const handleOrientationEulerChange = (event: RotationEulerChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		writeEuler(event.detail.value as RotationEulerValueObject)
	}

	const handleMixedEulerChange = (event: PointChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		writeEuler(event.detail.value as PointValue3dObject)
	}
</script>

{#snippet ImmutableField({
	label,
	value,
	ariaLabel,
}: {
	label?: string
	value: Shared<number> | string
	ariaLabel: string
})}
	<div>
		<span
			class="text-subtle-2"
			aria-label={`immutable ${ariaLabel}`}
		>
			{label}
		</span>

		{typeof value === 'string' ? value : formatSharedNumber(value)}
	</div>
{/snippet}

<WorldPoseDetails pose={worldPose} />

<div>
	<strong class="font-semibold">parent frame</strong>
	{#if editable}
		{#if parentEntity !== MIXED && parentEntity}
			<span class="text-subtle-2">
				— <EntityLink entity={parentEntity} />
			</span>
		{/if}
		<!--
			Remount on selection change. svelte-tweakpane-ui's List runs
			`listBlade.value = value` on the still-mounted blade before its
			`options` prop has propagated, so the new selection's parent name
			(absent from the previous selection's option set) hits Tweakpane's
			ListConstraint, snaps to the first option, and fires a change
			event that handleParentChange interprets as a user pick — silently
			reparenting the clicked frames.
		-->
		{#key selectionKey}
			<div aria-label="mutable parent frame">
				<List
					options={parentFrameOptions}
					value={parentName === MIXED ? MIXED_TEXT : parentName}
					on:change={handleParentChange}
				/>
			</div>
		{/key}
	{:else}
		<div class="mt-0.5 flex gap-3">
			{#if parentEntity !== MIXED && parentEntity}
				<EntityLink entity={parentEntity} />
			{:else}
				{@render ImmutableField({
					ariaLabel: 'parent frame name',
					value: parentName === MIXED ? MIXED_TEXT : parentName,
				})}
			{/if}
		</div>
	{/if}
</div>

<div>
	<strong class="font-semibold">local position</strong>
	<span class="text-subtle-2">(mm)</span>

	{#if editable}
		<div aria-label="mutable local position">
			<Point
				value={shownPosition}
				format={formatInputNumber}
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
						value={shownOrientation}
						format={formatInputNumber}
						on:change={handleOrientationOVChange}
					/>
				</TabPage>
				<TabPage title="Euler">
					<!-- The rotation plugin converts through a quaternion, where one NaN spreads to every angle. -->
					{#if isEulerMixed}
						<Point
							value={shownEuler}
							format={formatInputNumber}
							on:change={handleMixedEulerChange}
						/>
					{:else}
						<RotationEuler
							value={shownEuler}
							unit="deg"
							on:change={handleOrientationEulerChange}
						/>
					{/if}
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
