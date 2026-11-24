<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'
	import { Select } from '@viamrobotics/prime-controls'

	import type { PosePatch } from '#lib/math/index.js'

	import SharedPoseFields from '#lib/components/overlay/details/SharedPoseFields.svelte'
	import { MIXED, MIXED_TEXT } from '#lib/components/overlay/details/sharedValue.js'
	import { useSharedPose } from '#lib/components/overlay/details/useSharedPose.svelte.js'
	import WorldPoseDetails from '#lib/components/overlay/details/WorldPoseDetails.svelte'
	import EntityLink from '#lib/components/overlay/EntityLink.svelte'
	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { FrameEditor } from '#lib/editing/FrameEditor.js'
	import { useParentFrameOptions } from '#lib/hooks/useParentFrameOptions.svelte.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'

	interface Props {
		/** The selection. Never empty. */
		entities: readonly Entity[]
	}

	const { entities }: Props = $props()

	const { invalidate } = useThrelte()
	const partConfig = usePartConfig()
	const frameEditor = new FrameEditor(partConfig.updateFrame, partConfig.deleteFrame)

	const pose = useSharedPose(() => entities)

	const names = useMappedEntitiesTraits(
		() => entities,
		[traits.Name],
		(entity) => entity.get(traits.Name)
	)
	const parentOptions = useParentFrameOptions(() => names.current)

	/**
	 * `useParentFrameOptions` can lag the current parent, such as an unresolved orphan or frames
	 * that have not loaded yet, and a select shows no label for a value it has no item for. So a
	 * shared parent is always offered. It is cycle-safe, being neither self nor a descendant.
	 */
	const parentFrameItems = $derived.by(() => {
		const options = parentOptions.current
		const { parentName } = pose
		const items =
			parentName === MIXED || options.includes(parentName) ? options : [parentName, ...options]
		return items.map((name) => ({ value: name, label: name }))
	})

	const setParent = (value: string) => {
		for (const [index, entity] of entities.entries()) {
			if (pose.parentNames[index] !== value) frameEditor.setParent(entity, value)
		}
		invalidate()
	}

	const setPoses = (patches: PosePatch[]) => {
		for (const [index, entity] of entities.entries()) {
			const patch = patches[index]
			if (patch) frameEditor.setPose(entity, patch)
		}
		invalidate()
	}
</script>

<WorldPoseDetails pose={pose.worldPose} />

<div>
	<strong class="font-semibold">parent frame</strong>
	{#if pose.parentEntity !== MIXED && pose.parentEntity}
		<span class="text-subtle-2">
			— <EntityLink entity={pose.parentEntity} />
		</span>
	{/if}
	<Select
		aria-label="parent frame"
		items={parentFrameItems}
		placeholder={MIXED_TEXT}
		bind:value={
			() => (pose.parentName === MIXED ? undefined : pose.parentName),
			(next) => {
				if (next) setParent(next)
			}
		}
	/>
</div>

<SharedPoseFields
	poses={pose.localPoses}
	editable
	onchange={setPoses}
/>
