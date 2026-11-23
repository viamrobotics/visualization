<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'
	import { List, type ListChangeEvent } from 'svelte-tweakpane-ui'

	import type { PosePatch } from '#lib/math/index.js'

	import { relations, traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { FrameEditor } from '#lib/editing/FrameEditor.js'
	import { useParentFrameOptions } from '#lib/hooks/useParentFrameOptions.svelte.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { Pose } from '#lib/math/index.js'

	import EntityLink from '../EntityLink.svelte'
	import { composeDisplayedPose } from './composeDisplayedPose'
	import { MIXED_POSE, type SharedPose, sharedPose } from './sharedPose'
	import SharedPoseFields from './SharedPoseFields.svelte'
	import { MIXED, MIXED_TEXT, sharedValue } from './sharedValue'
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
	const worldPoses = $derived(reads.current.map((read) => read.worldPose))
	const definedWorldPoses = $derived(worldPoses.filter((pose) => pose !== undefined))
	// An entity whose world transform hasn't resolved, such as an orphan, isn't drawn at the
	// origin, so it has no world pose to share. One alone keeps reading as the origin.
	const worldPose = $derived.by((): SharedPose | undefined => {
		if (definedWorldPoses.length === 0) return undefined
		if (definedWorldPoses.length < worldPoses.length) return MIXED_POSE
		return sharedPose(definedWorldPoses)
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

	const handlePoseChange = (patches: PosePatch[]) => {
		for (const [index, entity] of entities.entries()) {
			const patch = patches[index]
			if (patch) frameEditor.setPose(entity, patch)
		}
		invalidate()
	}
</script>

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
				<div>
					<span
						class="text-subtle-2"
						aria-label="immutable parent frame name"
					></span>

					{parentName === MIXED ? MIXED_TEXT : parentName}
				</div>
			{/if}
		</div>
	{/if}
</div>

<SharedPoseFields
	poses={localPoses}
	{editable}
	onchange={handlePoseChange}
/>
