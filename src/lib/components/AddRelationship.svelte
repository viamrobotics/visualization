<script lang="ts">
	import type { Entity } from 'koota'
	import { Button, Select, Input } from '@viamrobotics/prime-core'
	import { traits, useQuery, relations, useTrait } from '$lib/ecs'

	interface Props {
		entity: Entity | undefined
	}

	const { entity }: Props = $props()

	const allEntities = useQuery(traits.Name)
	const name = useTrait(() => entity, traits.Name)
	const entityNames = $derived.by(() => {
		const currentEntityName = name.current
		return allEntities.current
			.map((e: Entity) => e.get(traits.Name))
			.filter((n: string | undefined): n is string => n !== undefined && n !== currentEntityName)
			.sort()
	})

	let showRelationshipOptions = $state(false)
	let selectedRelationshipType = $state<string>('')
	let selectedRelationshipEntity = $state<string>('')
	let relationshipFormula = $state('index')

	function resetForm() {
		selectedRelationshipType = ''
		selectedRelationshipEntity = ''
		relationshipFormula = 'index'
	}

	function handleAdd() {
		if (!entity || !relationshipFormula.includes('index')) return
		const selectedEntity = allEntities.current.find(
			(e: Entity) => e.get(traits.Name) === selectedRelationshipEntity
		)
		if (selectedEntity) {
			entity.add(
				relations.HoverLink(selectedEntity, {
					indexMapping: relationshipFormula,
				})
			)
		}
		resetForm()
	}
</script>

<Button
	class="mt-2 w-full"
	icon={showRelationshipOptions ? undefined : 'plus'}
	variant={showRelationshipOptions ? 'dark' : 'primary'}
	onclick={() => {
		if (showRelationshipOptions) {
			resetForm()
		}
		showRelationshipOptions = !showRelationshipOptions
	}}>{showRelationshipOptions ? 'Cancel' : 'Add Relationship'}</Button
>

{#if showRelationshipOptions}
	<div class="mt-2 flex flex-col gap-2">
		<div>
			<label
				for="relationship-type-select"
				class="text-subtle-2 mb-1 block text-xs">Relationship type</label
			>
			<Select
				id="relationship-type-select"
				aria-label="Select relationship type"
				value={selectedRelationshipType}
				onchange={(event: InputEvent) => {
					selectedRelationshipType = (event.target as HTMLSelectElement).value as 'HoverLink'
				}}
			>
				<option value="">Select a relationship type...</option>
				<option value="HoverLink">HoverLink</option>
			</Select>
		</div>
		<div>
			<label
				for="relationship-entity-select"
				class="text-subtle-2 mb-1 block text-xs">Entity</label
			>
			<Select
				id="relationship-entity-select"
				aria-label="Select entity for relationship"
				value={selectedRelationshipEntity}
				onchange={(event: InputEvent) => {
					selectedRelationshipEntity = (event.target as HTMLSelectElement).value
				}}
			>
				<option value="">Select an entity...</option>
				{#each entityNames as entityName (entityName)}
					<option value={entityName}>{entityName}</option>
				{/each}
			</Select>
		</div>
		<div>
			<label
				for="relationship-formula-input"
				class="text-subtle-2 mb-1 block text-xs">Index mapping</label
			>
			<Input
				on:keydown={(e) => e.stopPropagation()}
				id="relationship-formula-input"
				aria-label="Math formula for index mapping"
				bind:value={relationshipFormula}
				placeholder="index"
			/>
		</div>
		<div>
			<Button
				class="w-full"
				variant="primary"
				onclick={handleAdd}
			>
				Add
			</Button>
		</div>
	</div>
{/if}
