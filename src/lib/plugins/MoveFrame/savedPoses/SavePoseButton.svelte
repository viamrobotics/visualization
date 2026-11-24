<!--
@component

Saves where `arm` is right now as a new `erh:vmodutils:arm-position-saver` in the part config, and
adds the vmodutils module when the machine has nothing to load that model from.
-->
<script lang="ts">
	import { mdiContentSaveOutline } from '@mdi/js'
	import { TextField } from '@viamrobotics/prime-controls'
	import { Banner, Dialog, Icon, useToast } from '@viamrobotics/prime-ui'
	import { useResourceStatuses, useRobotClient } from '@viamrobotics/svelte-sdk'
	import { untrack } from 'svelte'

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
			toast.danger(`Cannot save a pose for "${arm}": its kinematics do not cover every joint.`)
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
			toast.danger('Cannot check which modules the machine runs. Reconnect and try again.')
			return
		}

		pendingName = saverName
		partConfig.createComponent(
			createArmPositionSaver(saverName, arm, joints, defaultService),
			isLoaded === false ? VMODUTILS_MODULE : undefined
		)
		open = false
		// A failed save already shows its own error toast.
		if (partConfig.canSave && !(await partConfig.save())) return
		toast.success(
			partConfig.canSave
				? `Saved the current pose of "${arm}" as ${saverName}.`
				: `Added ${saverName} to the config. Save the config to keep it.`
		)
	}

	const id = $props.id()
	const nameId = `${id}-name`
	const nameLabelId = `${id}-name-label`
	const errorId = `${id}-error`
</script>

<button
	type="button"
	class="button button-compact button-ghost"
	aria-disabled={disabledReason !== undefined || undefined}
	title={disabledReason ?? `Save where "${arm}" is now as a position saver`}
	onclick={() => {
		if (disabledReason === undefined) open = true
	}}
>
	<Icon icon={mdiContentSaveOutline} />
	Save current pose
</button>

<Dialog bind:open>
	<Dialog.Content class="w-full max-w-sm gap-3">
		<Dialog.Title>Save current pose</Dialog.Title>

		{#if hasStagedMove}
			<Banner variant="warning">
				<Banner.Title>A move is staged</Banner.Title>
				<Banner.Description>
					This saves where "{arm}" is now, not the target shown by the ghost.
				</Banner.Description>
			</Banner>
		{/if}

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
				aria-describedby={nameError === undefined ? undefined : errorId}
				bind:value={name}
				onkeydown={(event) => {
					if (event.key !== 'Enter') return
					event.preventDefault()
					void save()
				}}
				state={nameError === undefined ? undefined : 'error'}
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

		<div class="mt-1 flex justify-end gap-2">
			<Dialog.Close class="button button-compact button-ghost">Cancel</Dialog.Close>
			<button
				type="button"
				class="button button-compact"
				aria-disabled={nameError !== undefined || saving || undefined}
				aria-busy={saving || undefined}
				onclick={() => void save()}
			>
				{#if saving}
					<span
						class="progress-dots"
						aria-hidden="true"
					></span>
				{/if}
				Save
			</button>
		</div>
	</Dialog.Content>
</Dialog>
