<script lang="ts">
	import { formatNumeric } from '../../format'
	import Table from '../shared/Table.svelte'
	import { useDraggable } from '$lib/hooks/useDraggable.svelte'
	import { useArmClient } from '$lib/hooks/useArmClient.svelte'
	import { Icon, Label, Select } from '@viamrobotics/prime-core'

	const { ...rest } = $props()

	const draggable = useDraggable('arm-current-positions')
	const armClient = useArmClient()

	let selectedArm = $state(armClient.names[0])

	const positions = $derived(armClient.currentPositions[selectedArm])
</script>

<div
	class="bg-extralight border-medium absolute top-0 left-0 z-1000 m-2 overflow-y-auto border text-xs"
	style:transform="translate({draggable.current.x}px, {draggable.current.y}px)"
	{...rest}
>
	<div class="flex min-w-0 flex-col">
		<div class="flex w-full items-center justify-between">
			<div class="border-medium flex w-full items-center gap-1 border-b p-2">
				<button
					onmousedown={draggable.onDragStart}
					onmouseup={draggable.onDragEnd}
				>
					<Icon name="drag" />
				</button>
				<h3>Arm positions</h3>
			</div>
		</div>

		<div class="flex flex-col gap-2 p-2">
			<Label>
				Select arm
				<Select
					slot="input"
					value={selectedArm}
					name="arm"
					on:change={(event) => {
						selectedArm = (event.target as HTMLSelectElement).value
					}}
				>
					{#each armClient.names as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</Select>
			</Label>
			<Table>
				<thead>
					<tr>
						<th> Joint </th>
						<th>Position (degrees)</th>
					</tr>
				</thead>
				<tbody>
					{#if positions}
						{#each positions as position, index ([position, index])}
							<tr>
								<th> {index} </th>
								<th> {formatNumeric(position)} </th>
							</tr>
						{/each}
					{:else}
						<tr>
							<th colspan="2"> No positions </th>
						</tr>
					{/if}
				</tbody>
			</Table>
		</div>
	</div>
</div>
