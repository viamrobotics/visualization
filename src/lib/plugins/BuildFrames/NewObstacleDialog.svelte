<script lang="ts">
	import { TextField } from '@viamrobotics/prime-controls'
	import { Dialog } from '@viamrobotics/prime-ui'
	import { untrack } from 'svelte'

	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { useSelectOnArrival } from '#lib/hooks/useSelectOnArrival.svelte.js'
	import { useTakenResourceNames } from '#lib/hooks/useTakenResourceNames.js'
	import { nextObstacleName } from '#lib/obstacle.js'

	import { OBSTACLE_TYPE_OPTIONS, type ObstacleType } from './obstacleTypeOptions'

	interface Props {
		open: boolean
		/** Picked in the Add menu before the dialog opens. */
		type: ObstacleType
	}

	let { open = $bindable(), type }: Props = $props()

	const option = $derived(OBSTACLE_TYPE_OPTIONS[type])

	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const takenResourceNames = useTakenResourceNames()

	const takenNames = $derived(takenResourceNames.current)

	let name = $state('')

	// Seeded per opening. Reading the taken names untracked keeps the field from
	// being rewritten under the user when the config changes while they type.
	$effect(() => {
		if (!open) return
		name = nextObstacleName(
			untrack(() => takenNames),
			option.namePrefix
		)
	})

	const trimmedName = $derived(name.trim())

	const error = $derived.by(() => {
		if (trimmedName === '') return 'Enter a name.'
		if (takenNames.has(trimmedName)) return `This machine already uses the name ${trimmedName}.`
		return undefined
	})

	const pendingSelection = useSelectOnArrival()

	const create = () => {
		if (error !== undefined) return

		pendingSelection.select([trimmedName])

		// Config-only frames are merged into the scene in build mode. Creating an
		// obstacle anywhere else would write it to the config and show nothing.
		environment.current.mode = 'build'
		partConfig.createComponent(option.create(trimmedName))

		open = false
	}

	const id = $props.id()
	const nameId = `${id}-name`
	const nameLabelId = `${id}-name-label`
	const errorId = `${id}-error`
</script>

<Dialog bind:open>
	<Dialog.Content class="w-full max-w-sm gap-3">
		<Dialog.Title>{`New ${option.label.toLowerCase()} obstacle`}</Dialog.Title>

		<div>
			<label
				id={nameLabelId}
				for={nameId}
				class="text-subtle-2 mb-1 block text-xs"
			>
				Name
			</label>
			<TextField
				id={nameId}
				aria-labelledby={nameLabelId}
				aria-describedby={error === undefined ? undefined : errorId}
				bind:value={name}
				onkeydown={(event) => {
					if (event.key !== 'Enter') return
					event.preventDefault()
					create()
				}}
				state={error === undefined ? undefined : 'error'}
			/>
			{#if error !== undefined}
				<p
					id={errorId}
					class="text-danger-dark mt-1 text-xs"
				>
					{error}
				</p>
			{/if}
		</div>

		<div class="mt-1 flex justify-end gap-2">
			<Dialog.Close class="button button-compact button-ghost">Cancel</Dialog.Close>
			<button
				type="button"
				class="button button-compact"
				aria-disabled={error !== undefined}
				onclick={create}
			>
				Create
			</button>
		</div>
	</Dialog.Content>
</Dialog>
