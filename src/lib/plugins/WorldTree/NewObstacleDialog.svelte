<script lang="ts">
	import { Button, Input, InputStates } from '@viamrobotics/prime-core'
	import { untrack } from 'svelte'

	import Dialog from '#lib/components/overlay/Dialog.svelte'
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { useFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { useSelectOnArrival } from '#lib/hooks/useSelectOnArrival.svelte.js'
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
	const fragmentInfo = useFragmentInfo()
	const partConfig = usePartConfig()

	const takenNames = $derived([
		...(partConfig.current.components ?? []).map(({ name }) => name),
		...Object.keys(fragmentInfo.current ?? {}),
	])

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
		if (takenNames.includes(trimmedName))
			return `This machine already has a component named ${trimmedName}.`
		return undefined
	})

	const selectOnArrival = useSelectOnArrival()

	const create = () => {
		if (error !== undefined) return

		selectOnArrival([trimmedName])

		// Config-only frames are merged into the scene in build mode. Creating an
		// obstacle anywhere else would write it to the config and show nothing.
		environment.current.mode = 'build'
		partConfig.createComponent(option.create(trimmedName))

		open = false
	}

	const id = $props.id()
	const nameId = `${id}-name`
	const errorId = `${id}-error`
</script>

<Dialog
	bind:open
	role="dialog"
	title={`New ${option.label.toLowerCase()} obstacle`}
>
	<div>
		<label
			for={nameId}
			class="text-subtle-2 mb-1 block text-xs"
		>
			Name
		</label>
		<Input
			id={nameId}
			aria-describedby={error === undefined ? undefined : errorId}
			bind:value={name}
			onkeydown={(event: KeyboardEvent) => {
				if (event.key !== 'Enter') return
				event.preventDefault()
				create()
			}}
			state={error === undefined ? InputStates.NONE : InputStates.ERROR}
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

	{#snippet actions({ close })}
		<Button
			variant="ghost"
			onclick={close}
		>
			Cancel
		</Button>
		<Button
			variant="primary"
			aria-disabled={error !== undefined}
			class={error === undefined ? undefined : 'cursor-not-allowed opacity-50'}
			onclick={create}
		>
			Create
		</Button>
	{/snippet}
</Dialog>
