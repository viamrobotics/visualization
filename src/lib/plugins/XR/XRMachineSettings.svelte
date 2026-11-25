<script lang="ts">
	import { Select, Slider, ToggleButtons } from '@viamrobotics/prime-controls'
	import { type SelectOption, Switch } from '@viamrobotics/prime-ui'
	import { useResourceStatuses } from '@viamrobotics/svelte-sdk'

	import type { Settings } from '#lib/hooks/useSettings.svelte.js'

	import { useArmClient } from '#lib/hooks/useArmClient.svelte.js'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	const settings = useSettings()
	const uid = $props.id()
	const armClient = useArmClient()
	const partID = usePartID()
	const resources = useResourceStatuses(() => partID.current, 'gripper')
	const cameraResources = useResourceStatuses(() => partID.current, 'camera')

	const SCALE_FACTOR = { min: 0.1, max: 3, step: 0.1 } as const

	type Hand = 'left' | 'right'

	const hands: { hand: Hand; heading: string }[] = [
		{ hand: 'left', heading: 'Left Controller' },
		{ hand: 'right', heading: 'Right Controller' },
	]

	const otherHand = (hand: Hand): Hand => (hand === 'left' ? 'right' : 'left')

	const modeItems: { label: string; value: Settings['xrMode'] }[] = [
		{ label: 'Teleop', value: 'arm-teleop' },
		{ label: 'Frames', value: 'frame-configure' },
	]

	const armNames = $derived(armClient.names || [])
	const gripperNames = $derived(
		resources.current
			.filter((r) => r.name?.subtype === 'gripper' && r.name.type === 'component')
			.map((r) => r.name?.name)
			.filter((name): name is string => name !== undefined)
	)
	const cameraNames = $derived(
		cameraResources.current
			.filter((r) => r.name?.subtype === 'camera' && r.name.type === 'component')
			.map((r) => r.name?.name)
			.filter((name): name is string => name !== undefined)
	)

	const config = $derived(settings.current.xrController)

	// A name the other controller holds is not offered to this one.
	const availableArms = (hand: Hand) =>
		armNames.filter(
			(name) => name === config[hand].armName || name !== config[otherHand(hand)].armName
		)

	const availableGrippers = (hand: Hand) =>
		gripperNames.filter(
			(name) => name === config[hand].gripperName || name !== config[otherHand(hand)].gripperName
		)

	function updateConfig(hand: Hand, key: string, value: string | number | boolean | undefined) {
		settings.current.xrController[hand] = {
			...settings.current.xrController[hand],
			[key]: value,
		}
	}

	function toSelectItems(names: string[]): SelectOption[] {
		return [{ value: '', label: 'None' }, ...names.map((name) => ({ value: name, label: name }))]
	}

	function toggleCamera(name: string, on: boolean) {
		const next = new Set(settings.current.xrCameras)
		if (on) {
			next.add(name)
		} else {
			next.delete(name)
		}
		settings.current.xrCameras = [...next]
	}
</script>

<div class="flex flex-col gap-2.5">
	<ToggleButtons
		label="Controllers"
		items={modeItems}
		bind:value={
			() => settings.current.xrMode,
			(mode) => {
				// Pressing the active button clears the group's value. The controllers
				// always have a mode, so an empty selection keeps the current one.
				if (mode) settings.current.xrMode = mode as Settings['xrMode']
			}
		}
	/>

	<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Cameras</strong></h3>

	{#if cameraNames.length === 0}
		<p class="text-subtle-2">No cameras on this machine.</p>
	{:else}
		{#each cameraNames as name (name)}
			<label class="flex items-center justify-between gap-2">
				{name}
				<Switch
					bind:checked={
						() => settings.current.xrCameras.includes(name), (isOn) => toggleCamera(name, isOn)
					}
				/>
			</label>
		{/each}
	{/if}

	{#each hands as { hand, heading } (hand)}
		<h3 class="border-gray-3 border-b py-1 text-sm"><strong>{heading}</strong></h3>

		<div class="flex items-center justify-between gap-2">
			<span id="{uid}-{hand}-arm">Arm</span>
			<Select
				aria-labelledby="{uid}-{hand}-arm"
				placeholder="None"
				items={toSelectItems(availableArms(hand))}
				bind:value={
					() => config[hand].armName || '',
					(armName) => updateConfig(hand, 'armName', armName || undefined)
				}
			/>
		</div>

		<div class="flex items-center justify-between gap-2">
			<span id="{uid}-{hand}-gripper">Gripper</span>
			<Select
				aria-labelledby="{uid}-{hand}-gripper"
				placeholder="None"
				items={toSelectItems(availableGrippers(hand))}
				bind:value={
					() => config[hand].gripperName || '',
					(gripperName) => updateConfig(hand, 'gripperName', gripperName || undefined)
				}
			/>
		</div>

		<Slider
			label="Scale"
			{...SCALE_FACTOR}
			bind:value={
				() => config[hand].scaleFactor,
				(scaleFactor) => {
					// The readout accepts typed values outside the range.
					if (Number.isNaN(scaleFactor)) return
					const clamped = Math.min(SCALE_FACTOR.max, Math.max(SCALE_FACTOR.min, scaleFactor))
					updateConfig(hand, 'scaleFactor', clamped)
				}
			}
		/>

		<label class="flex items-center justify-between gap-2">
			Rotation
			<Switch
				bind:checked={
					() => config[hand].rotationEnabled,
					(isEnabled) => updateConfig(hand, 'rotationEnabled', isEnabled)
				}
			/>
		</label>
	{/each}
</div>
