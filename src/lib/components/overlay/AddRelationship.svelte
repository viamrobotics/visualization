<script lang="ts">
	import type { Entity } from 'koota'

	import { mdiPlus } from '@mdi/js'
	import { Select, TextField } from '@viamrobotics/prime-controls'
	import { Icon } from '@viamrobotics/prime-ui'

	import { relations, traits, useQuery, useTrait } from '#lib/ecs/index.js'
	import { SubEntityLinkType } from '#lib/ecs/relations.js'

	interface Props {
		entity: Entity | undefined
	}

	const { entity }: Props = $props()

	const allNamed = useQuery(traits.Name)
	const name = useTrait(() => entity, traits.Name)
	const drawAPI = useTrait(() => entity, traits.DrawAPI)
	const isDrawn = $derived(!!drawAPI.current)

	const entityNames = $derived.by(() => {
		const currentEntityName = name.current
		return allNamed.current
			.filter((e: Entity) => {
				const entityName = e.get(traits.Name)
				if (!entityName || entityName === currentEntityName) return false
				if (isDrawn) return !!e.get(traits.DrawAPI)
				return true
			})
			.map((e: Entity) => e.get(traits.Name)!)
			.toSorted()
	})

	const relationshipTypeItems = [
		{ value: '', label: 'Select a relationship type...' },
		{ value: SubEntityLinkType.HoverLink, label: 'HoverLink' },
	]

	const entityItems = $derived([
		{ value: '', label: 'Select an entity...' },
		...entityNames.map((entityName) => ({ value: entityName, label: entityName })),
	])

	let showRelationshipOptions = $state(false)
	let selectedRelationshipType = $state<string>('')
	let selectedRelationshipEntity = $state<string>('')
	let relationshipFormula = $state('index')

	const linkType = $derived.by(() => {
		return selectedRelationshipType === SubEntityLinkType.HoverLink
			? SubEntityLinkType.HoverLink
			: null
	})

	function resetForm() {
		selectedRelationshipType = ''
		selectedRelationshipEntity = ''
		relationshipFormula = 'index'
	}

	function handleAdd() {
		if (!entity || !relationshipFormula.includes('index')) return
		const selectedEntity = allNamed.current.find(
			(e: Entity) => e.get(traits.Name) === selectedRelationshipEntity
		)
		if (!selectedEntity) return

		entity.add(
			relations.SubEntityLink(selectedEntity, {
				indexMapping: relationshipFormula,
				type: linkType,
			})
		)
		showRelationshipOptions = false
		resetForm()
	}
</script>

<button
	type="button"
	class={['button button-compact mt-2 w-full', showRelationshipOptions && 'button-dark']}
	onclick={() => {
		if (showRelationshipOptions) {
			resetForm()
		}
		showRelationshipOptions = !showRelationshipOptions
	}}
>
	{#if !showRelationshipOptions}
		<Icon icon={mdiPlus} />
	{/if}
	{showRelationshipOptions ? 'Cancel' : 'Add Relationship'}
</button>

{#if showRelationshipOptions}
	<div class="mt-2 flex flex-col gap-2">
		<div>
			<span class="text-subtle-2 mb-1 block text-xs">Relationship type</span>
			<Select
				aria-label="Select relationship type"
				items={relationshipTypeItems}
				bind:value={selectedRelationshipType}
			/>
		</div>
		<div>
			<span class="text-subtle-2 mb-1 block text-xs">Entity</span>
			<Select
				aria-label="Select entity for relationship"
				items={entityItems}
				bind:value={selectedRelationshipEntity}
			/>
		</div>
		<div>
			<label
				for="relationship-formula-input"
				class="text-subtle-2 mb-1 block text-xs">Index mapping</label
			>
			<TextField
				onkeydown={(event) => event.stopPropagation()}
				id="relationship-formula-input"
				aria-label="Math formula for index mapping"
				bind:value={relationshipFormula}
				placeholder="index"
			/>
		</div>
		<div>
			<button
				type="button"
				class="button button-compact w-full"
				onclick={handleAdd}
			>
				Add
			</button>
		</div>
	</div>
{/if}
