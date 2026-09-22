<script lang="ts">
	import { Button, Input, InputStates } from '@viamrobotics/prime-core'
	import { onDestroy, untrack } from 'svelte'

	import Dialog from '$lib/components/overlay/Dialog.svelte'
	import { selectOnly, traits, useWorld } from '$lib/ecs'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useFragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { createObstacleComponent, nextObstacleName } from '$lib/obstacle'

	interface Props {
		open: boolean
	}

	let { open = $bindable() }: Props = $props()

	const world = useWorld()
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
		name = nextObstacleName(untrack(() => takenNames))
	})

	const trimmedName = $derived(name.trim())

	const error = $derived.by(() => {
		if (trimmedName === '') return 'Enter a name.'
		if (takenNames.includes(trimmedName))
			return `This machine already has a component named ${trimmedName}.`
		return undefined
	})

	/**
	 * The obstacle the frame reconciler owes us an entity for. Creating writes the
	 * config, and the entity only exists once `useFrames` has reconciled it, so
	 * the selection waits for the row rather than racing it.
	 */
	let pendingName: string | undefined

	onDestroy(
		world.onAdd(traits.Name, (entity) => {
			if (pendingName === undefined || entity.get(traits.Name) !== pendingName) return

			pendingName = undefined
			selectOnly(world, entity)
		})
	)

	const create = () => {
		if (error !== undefined) return

		pendingName = trimmedName

		// Config-only frames are merged into the scene in build mode. Creating an
		// obstacle anywhere else would write it to the config and show nothing.
		environment.current.mode = 'build'
		partConfig.createComponent(createObstacleComponent(trimmedName))

		open = false
	}

	const id = $props.id()
	const nameId = `${id}-name`
	const errorId = `${id}-error`
</script>

<Dialog
	bind:open
	role="dialog"
	title="New obstacle"
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
