<script
	module
	lang="ts"
>
	import type { EnvironmentMode } from '$lib/hooks/useEnvironment.svelte'

	const appearance = {
		monitor: {
			label: 'Monitor',
			idle: 'text-gray-8',
			border: 'border-info-medium',
			fill: 'bg-info-light text-info-dark',
		},
		build: {
			label: 'Build',
			idle: 'text-gray-8',
			border: 'border-info-medium',
			fill: 'bg-info-light text-info-dark',
		},
		move: {
			label: 'Move',
			idle: 'text-gray-8',
			border: 'border-info-medium',
			fill: 'bg-info-light text-info-dark',
		},
	} as const satisfies Record<
		EnvironmentMode,
		{ label: string; idle: string; border: string; fill: string }
	>
</script>

<script lang="ts">
	import type { ClassValue } from 'svelte/elements'

	import { Icon, Button as PrimeButton, Tooltip } from '@viamrobotics/prime-core'
	import { Hammer, Move3d } from 'lucide-svelte'

	import Dialog from '$lib/components/overlay/Dialog.svelte'
	import { useWorld } from '$lib/ecs'
	import { resetStagedEdits } from '$lib/editing/resetStagedEdits'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	interface Props {
		/** The mode this button switches the app into. */
		mode: EnvironmentMode
		description: string
		class?: ClassValue
	}

	const { mode, description, class: className }: Props = $props()

	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const world = useWorld()

	let confirmOpen = $state(false)

	const style = $derived(appearance[mode])
	const isSelected = $derived(environment.current.mode === mode)

	// Leaving build mode with staged edits would silently hide them, so confirm
	// first. Switching without unsaved edits (or into build) is unguarded.
	const request = () => {
		if (mode !== 'build' && environment.current.mode === 'build' && partConfig.isDirty) {
			confirmOpen = true
			return
		}

		environment.current.mode = mode
	}

	const discardAndSwitch = () => {
		partConfig.discardChanges()
		resetStagedEdits(world)
		environment.current.mode = mode
		confirmOpen = false
	}
</script>

<Tooltip
	let:tooltipID
	location="bottom"
>
	<label
		class={[
			className,
			'relative block rounded-md border bg-white',
			isSelected ? ['z-4', style.border] : 'border-gray-5 hover:bg-light active:bg-medium',
		]}
		aria-describedby={tooltipID}
	>
		<button
			class={['flex items-center rounded-[inherit] p-1.5', isSelected ? style.fill : style.idle]}
			role="radio"
			aria-label={description}
			aria-checked={isSelected}
			onclick={request}
		>
			{#if mode === 'monitor'}
				<Icon name="eye-outline" />
			{:else if mode === 'build'}
				<Hammer size="16" />
			{:else}
				<Move3d size="16" />
			{/if}

			<span
				class="font-public-sans grid text-xs font-medium transition-[grid-template-columns] duration-150 ease-out motion-reduce:transition-none"
				style:grid-template-columns={isSelected ? '1fr' : '0fr'}
				aria-hidden="true"
			>
				<span class="overflow-hidden">
					<span class="block pl-1.5 whitespace-nowrap">{style.label}</span>
				</span>
			</span>
		</button>
	</label>
	<p slot="description">{description}</p>
</Tooltip>

<Dialog
	bind:open={confirmOpen}
	title="Discard unsaved changes?"
	description={`Switching to ${mode} mode will discard your unsaved frame edits.`}
>
	{#snippet actions({ close })}
		<PrimeButton onclick={close}>Cancel</PrimeButton>
		<PrimeButton
			variant="dark"
			onclick={discardAndSwitch}
		>
			Discard
		</PrimeButton>
	{/snippet}
</Dialog>
