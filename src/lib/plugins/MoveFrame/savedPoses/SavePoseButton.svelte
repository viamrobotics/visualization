<!--
@component

Saves where `arm` is right now as a new `erh:vmodutils:arm-position-saver` in the part config, and
adds the vmodutils module when the machine has nothing to load that model from.
-->
<script lang="ts">
	import {
		Banner,
		BannerVariant,
		Button,
		Input,
		InputStates,
		ToastVariant,
		useToast,
	} from '@viamrobotics/prime-core'
	import { useResourceStatuses, useRobotClient } from '@viamrobotics/svelte-sdk'
	import { untrack } from 'svelte'

	import Dialog from '#lib/components/overlay/Dialog.svelte'
	import { selectOnly, traits, useWorld } from '#lib/ecs/index.js'
	import { useArmClient } from '#lib/hooks/useArmClient.svelte.js'
	import { useFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import { useFrames } from '#lib/hooks/useFrames.svelte.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { buildFrameDescriptors } from '#lib/motion/frameDescriptors.js'
	import { frameSystemToPlanFrames } from '#lib/motion/frameSystemToPlanFrames.js'
	import { nextObstacleName } from '#lib/obstacle.js'

	import { defaultMotionService, motionServiceNames } from '../moveControls'
	import { armInputsFromJointPositions } from './armInputsFromJointPositions'
	import {
		ARM_POSITION_SAVER_MODEL,
		createArmPositionSaver,
		VMODUTILS_MODULE,
	} from './armPositionSaver'

	interface Props {
		arm: string
		/** Whether a move target is staged, which the dialog warns this does not save. */
		hasStagedMove: boolean
	}

	const { arm, hasStagedMove }: Props = $props()

	const world = useWorld()
	const partID = usePartID()
	const robotClient = useRobotClient(() => partID.current)
	const partConfig = usePartConfig()
	const fragmentInfo = useFragmentInfo()
	const armClient = useArmClient()
	const frames = useFrames()
	const toast = useToast()

	const motionResources = useResourceStatuses(() => partID.current, 'motion')
	const defaultService = $derived(
		defaultMotionService(
			motionServiceNames(
				motionResources.current
					.map((resource) => resource.name)
					.filter((resourceName) => resourceName !== undefined)
			)
		)
	)

	const positions = $derived(armClient.currentPositions[arm])

	const disabledReason = $derived.by(() => {
		if (!partConfig.hasConfigSource || !partConfig.hasEditPermissions) {
			return 'You do not have permission to edit this machine’s config.'
		}
		if (positions === undefined) return `Waiting for the joint positions of "${arm}".`
		return undefined
	})

	const takenNames = $derived([
		...(partConfig.current.components ?? []).map((component) => component.name),
		...Object.keys(fragmentInfo.current ?? {}),
	])

	let open = $state(false)
	let name = $state('')
	let saving = $state(false)

	$effect(() => {
		if (!open) return
		name = nextObstacleName(
			untrack(() => takenNames),
			`${arm}-pose`
		)
	})

	const trimmedName = $derived(name.trim())

	const nameError = $derived.by(() => {
		if (trimmedName === '') return 'Enter a name.'
		if (takenNames.includes(trimmedName))
			return `This machine already has a component named ${trimmedName}.`
		return undefined
	})

	/** The saver the config owes us a row for, selected once `useSavedPoseEntities` spawns it. */
	let pendingName: string | undefined

	$effect(() => {
		return world.onAdd(traits.SavedPose, (entity) => {
			if (pendingName === undefined || entity.get(traits.Name) !== pendingName) return
			pendingName = undefined
			selectOnly(world, entity)
		})
	})

	/**
	 * Whether the running machine already serves the saver model, from any module, or `undefined`
	 * when the machine cannot be asked. A module from a fragment is not in the part's own
	 * `modules`, so the config alone cannot say.
	 */
	const isSaverModelLoaded = async (): Promise<boolean | undefined> => {
		const client = robotClient.current
		if (!client) return undefined

		try {
			const models = await client.getModelsFromModules()
			return models.some(({ model }) => model === ARM_POSITION_SAVER_MODEL)
		} catch {
			return undefined
		}
	}

	const isModuleInPartConfig = () =>
		(partConfig.current.modules ?? []).some(
			({ module_id }) => module_id === VMODUTILS_MODULE.module_id
		)

	const save = async () => {
		if (saving || nameError !== undefined || disabledReason !== undefined) return
		if (positions === undefined) return

		const descriptors = buildFrameDescriptors(frameSystemToPlanFrames(frames.parts))
		const joints = armInputsFromJointPositions(descriptors, arm, positions)
		if (joints === undefined) {
			toast({
				message: `Cannot save a pose for "${arm}": its kinematics do not cover every joint.`,
				variant: ToastVariant.Danger,
			})
			return
		}

		const saverName = trimmedName
		saving = true
		const isLoaded = await isSaverModelLoaded()
		saving = false

		// The dialog may have closed, or the name been taken, while the machine was answering.
		if (!open) return
		if (takenNames.includes(saverName)) return

		// Unknown is not "absent": a fragment may already load the module, and a second entry beside
		// it would fight its pinned version.
		if (isLoaded === undefined && !isModuleInPartConfig()) {
			toast({
				message: 'Cannot check which modules the machine runs. Reconnect and try again.',
				variant: ToastVariant.Danger,
			})
			return
		}

		pendingName = saverName
		partConfig.createComponent(
			createArmPositionSaver(saverName, arm, joints, defaultService),
			isLoaded === false ? VMODUTILS_MODULE : undefined
		)
		if (partConfig.canSave) partConfig.save()

		open = false
		toast({
			message: partConfig.canSave
				? `Saved the current pose of "${arm}" as ${saverName}.`
				: `Added ${saverName} to the config. Save the config to keep it.`,
			variant: ToastVariant.Success,
		})
	}

	const id = $props.id()
	const nameId = `${id}-name`
	const errorId = `${id}-error`
</script>

<Button
	variant="ghost"
	icon="content-save-outline"
	aria-disabled={disabledReason !== undefined}
	class={disabledReason === undefined ? undefined : 'cursor-not-allowed opacity-50'}
	title={disabledReason ?? `Save where "${arm}" is now as a position saver`}
	onclick={() => {
		if (disabledReason === undefined) open = true
	}}
>
	Save current pose
</Button>

<Dialog
	bind:open
	role="dialog"
	title="Save current pose"
>
	{#if hasStagedMove}
		<Banner
			variant={BannerVariant.Warning}
			size="sm"
		>
			{#snippet titleContent()}
				A move is staged
			{/snippet}
			{#snippet subtitle()}
				This saves where "{arm}" is now, not the target shown by the ghost.
			{/snippet}
		</Banner>
	{/if}

	<div>
		<label
			for={nameId}
			class="text-subtle-2 mb-1 block text-xs"
		>
			Name
		</label>
		<Input
			id={nameId}
			aria-describedby={nameError === undefined ? undefined : errorId}
			bind:value={name}
			onkeydown={(event: KeyboardEvent) => {
				if (event.key !== 'Enter') return
				event.preventDefault()
				void save()
			}}
			state={nameError === undefined ? InputStates.NONE : InputStates.ERROR}
		/>
		{#if nameError !== undefined}
			<p
				id={errorId}
				class="text-danger-dark mt-1 text-xs"
			>
				{nameError}
			</p>
		{/if}
		<p class="text-subtle-2 mt-2 text-xs">
			Saves the joint positions of "{arm}" right now to the machine config.
		</p>
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
			aria-disabled={nameError !== undefined || saving}
			class={nameError === undefined ? undefined : 'cursor-not-allowed opacity-50'}
			progress={saving ? 'indeterminate' : undefined}
			onclick={() => void save()}
		>
			Save
		</Button>
	{/snippet}
</Dialog>
