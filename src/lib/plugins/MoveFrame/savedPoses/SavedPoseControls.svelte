<!--
@component

Details for a selected saved pose: which motion service plans the saver's moves, and the button that
drives its arm there through the saver's "go to" switch position.
-->
<script lang="ts">
	import type { Entity } from 'koota'
	import type { HTMLAttributes } from 'svelte/elements'

	import { Button, ToastVariant, useToast } from '@viamrobotics/prime-core'
	import { SwitchClient } from '@viamrobotics/sdk'
	import { createResourceClient, useResourceStatuses } from '@viamrobotics/svelte-sdk'
	import { List, type ListChangeEvent } from 'svelte-tweakpane-ui'

	import DetailsPanel from '$lib/components/overlay/details/DetailsPanel.svelte'
	import Dialog from '$lib/components/overlay/Dialog.svelte'
	import { traits, useTrait } from '$lib/ecs'
	import { useResourceHealth } from '$lib/hooks/resources/useResourceHealth.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useResourceByName } from '$lib/hooks/useResourceByName.svelte'

	import { motionServiceNames } from '../moveControls'
	import { moveExecutionOwner } from '../moveExecutionOwner.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		entity: Entity
	}

	const { entity, ...rest }: Props = $props()

	/** `arm-position-saver`'s "go to" position. Index 0 is idle and 1 saves. */
	const GO_TO_POSITION = 2

	const NO_SERVICE_LABEL = 'choose a service'

	const id = $props.id()
	const motionLabelId = `${id}-motion`

	const partID = usePartID()
	const partConfig = usePartConfig()
	const toast = useToast()
	const health = useResourceHealth()
	const resourceByName = useResourceByName()
	const motionResources = useResourceStatuses(() => partID.current, 'motion')

	const name = useTrait(() => entity, traits.Name)
	const savedPose = useTrait(() => entity, traits.SavedPose)

	const saverName = $derived(name.current ?? '')
	const arm = $derived(savedPose.current?.arm ?? '')
	const motion = $derived(savedPose.current?.motion ?? '')

	const saver = createResourceClient(
		SwitchClient,
		() => partID.current,
		() => saverName
	)

	const motionServices = $derived(
		motionServiceNames(
			motionResources.current
				.map((resource) => resource.name)
				.filter((resourceName) => resourceName !== undefined)
		)
	)

	/**
	 * Label to value. Keeps a configured service the machine no longer has, so the selector shows what
	 * the saver will actually call rather than silently picking another.
	 */
	const motionOptions = $derived.by(() => {
		const names =
			motion === '' || motionServices.includes(motion)
				? motionServices
				: [motion, ...motionServices]
		const options: Record<string, string> = motion === '' ? { [NO_SERVICE_LABEL]: '' } : {}
		for (const service of names) options[service] = service
		return options
	})

	const canEditConfig = $derived(partConfig.hasConfigSource && partConfig.hasEditPermissions)

	const target = $derived.by(() => {
		if (savedPose.current?.joints) return 'joint positions'
		if (savedPose.current?.pose) return 'end pose'
		return undefined
	})

	const isMoving = $derived(moveExecutionOwner.movingFrame === arm)

	const disabledReason = $derived.by(() => {
		if (target === undefined) return `${saverName} has no pose saved yet.`
		if (motion === '') return 'Choose a motion service to plan the move.'
		if (resourceByName.current[saverName] === undefined) return `${saverName} is not running yet.`
		if (health.statusFor(saverName)) return `${saverName} is not healthy.`
		if (isMoving) return `Moving "${arm}".`
		if (moveExecutionOwner.movingFrame !== undefined) return 'Another move is running.'
		return undefined
	})

	/** Writes the saver's `motion` and saves, which rebuilds the saver with the new service. */
	const handleServiceChange = (event: ListChangeEvent) => {
		if (event.detail.origin !== 'internal') return

		const next = event.detail.value as string
		if (next === '' || next === motion) return

		const component = partConfig.current.components.find(
			(candidate) => candidate.name === saverName
		)
		if (!component) return

		partConfig.updateComponent(saverName, {
			attributes: { ...component.attributes, motion: next },
		})
		if (partConfig.canSave) partConfig.save()
	}

	const moveToPose = async () => {
		const client = saver.current
		if (!client || disabledReason !== undefined) return
		if (!moveExecutionOwner.claim(arm)) return

		try {
			await client.setPosition(GO_TO_POSITION)
			toast({ message: `Moved "${arm}" to ${saverName}.`, variant: ToastVariant.Success })
		} catch (error) {
			toast({
				message:
					error instanceof Error ? error.message : `Failed to move "${arm}" to ${saverName}.`,
				variant: ToastVariant.Danger,
			})
		} finally {
			moveExecutionOwner.release(arm)
		}
	}

	let deleteOpen = $state(false)

	const deleteSaver = () => {
		deleteOpen = false
		partConfig.deleteComponent(saverName)
		if (partConfig.canSave) partConfig.save()
		toast({
			message: partConfig.canSave
				? `Deleted ${saverName}.`
				: `Removed ${saverName} from the config. Save the config to keep the change.`,
			variant: ToastVariant.Success,
		})
	}
</script>

<DetailsPanel
	{entity}
	{...rest}
>
	<div class="bg-extralight px-2 pb-2">
		<h3 class="text-subtle-2 pt-3 pb-2">Saved pose</h3>

		<div class="flex flex-col gap-3">
			<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
				<dt class="text-subtle-2">arm</dt>
				<dd class="font-roboto-mono">{arm}</dd>
				<dt class="text-subtle-2">saved</dt>
				<dd>{target ?? 'nothing yet'}</dd>
			</dl>

			<div
				role="group"
				aria-labelledby={motionLabelId}
			>
				<strong
					id={motionLabelId}
					class="font-semibold">motion service</strong
				>
				<List
					options={motionOptions}
					value={motion}
					disabled={!canEditConfig || isMoving}
					on:change={handleServiceChange}
				/>
			</div>

			<div>
				<div class="flex flex-wrap items-center gap-2">
					<Button
						variant="success"
						aria-disabled={disabledReason !== undefined}
						class={disabledReason === undefined ? undefined : 'cursor-not-allowed opacity-50'}
						progress={isMoving ? 'indeterminate' : undefined}
						title={disabledReason ?? `Move "${arm}" to ${saverName}`}
						onclick={() => void moveToPose()}
					>
						Move to pose
					</Button>
					<Button
						variant="outline-danger"
						aria-disabled={!canEditConfig || isMoving}
						class={canEditConfig && !isMoving ? undefined : 'cursor-not-allowed opacity-50'}
						title={canEditConfig
							? `Remove ${saverName} from the machine config`
							: 'You do not have permission to edit this machine’s config.'}
						onclick={() => {
							if (canEditConfig && !isMoving) deleteOpen = true
						}}
					>
						Delete
					</Button>
				</div>
				{#if disabledReason !== undefined && !isMoving}
					<p class="text-subtle-2 mt-1 text-xs">{disabledReason}</p>
				{/if}
			</div>
		</div>
	</div>
</DetailsPanel>

<Dialog
	bind:open={deleteOpen}
	title={`Delete ${saverName}?`}
	description={`Removes the saved pose of "${arm}" from the machine config.`}
>
	{#snippet actions({ close })}
		<Button
			variant="ghost"
			onclick={close}
		>
			Cancel
		</Button>
		<Button
			variant="danger"
			onclick={deleteSaver}
		>
			Delete
		</Button>
	{/snippet}
</Dialog>
