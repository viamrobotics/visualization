<script lang="ts">
	import { Select } from '@viamrobotics/prime-controls'
	import { type SelectOption, Switch } from '@viamrobotics/prime-ui'
	import { useResourceStatuses } from '@viamrobotics/svelte-sdk'

	import { useArmClient } from '#lib/hooks/useArmClient.svelte.js'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	const settings = useSettings()
	const uid = $props.id()
	const armClient = useArmClient()
	const partID = usePartID()
	const resources = useResourceStatuses(() => partID.current, 'gripper')
	const cameraResources = useResourceStatuses(() => partID.current, 'camera')

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

	// Filter available arms/grippers - exclude what the other controller has selected
	const leftAvailableArms = $derived(
		armNames.filter((name) => name === config.left.armName || name !== config.right.armName)
	)
	const rightAvailableArms = $derived(
		armNames.filter((name) => name === config.right.armName || name !== config.left.armName)
	)

	const leftAvailableGrippers = $derived(
		gripperNames.filter(
			(name) => name === config.left.gripperName || name !== config.right.gripperName
		)
	)
	const rightAvailableGrippers = $derived(
		gripperNames.filter(
			(name) => name === config.right.gripperName || name !== config.left.gripperName
		)
	)

	function updateConfig(
		hand: 'left' | 'right',
		key: string,
		value: string | number | boolean | undefined
	) {
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

<div class="flex flex-col gap-2.5 text-xs">
	<div class="flex flex-col gap-2.5">
		<label class="flex items-center justify-between gap-2">
			Enable VR / AR mode <Switch bind:checked={settings.current.enableXR} />
		</label>

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

		<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Left Controller</strong></h3>

		<div class="flex items-center justify-between gap-2">
			<span id="{uid}-left-arm">Arm</span>
			<Select
				aria-labelledby="{uid}-left-arm"
				placeholder="None"
				items={toSelectItems(leftAvailableArms)}
				bind:value={
					() => config.left.armName || '',
					(armName) => updateConfig('left', 'armName', armName || undefined)
				}
			/>
		</div>

		<div class="flex items-center justify-between gap-2">
			<span id="{uid}-left-gripper">Gripper</span>
			<Select
				aria-labelledby="{uid}-left-gripper"
				placeholder="None"
				items={toSelectItems(leftAvailableGrippers)}
				bind:value={
					() => config.left.gripperName || '',
					(gripperName) => updateConfig('left', 'gripperName', gripperName || undefined)
				}
			/>
		</div>

		<label class="flex items-center justify-between gap-2">
			Scale: {config.left.scaleFactor.toFixed(1)}
			<input
				class="w-20"
				type="range"
				min="0.1"
				max="3.0"
				step="0.1"
				value={config.left.scaleFactor}
				style="--value: {((config.left.scaleFactor - 0.1) / (3 - 0.1)) * 100}%"
				oninput={(e) =>
					updateConfig('left', 'scaleFactor', Number.parseFloat(e.currentTarget.value))}
			/>
		</label>

		<label class="flex items-center justify-between gap-2">
			Rotation
			<Switch
				bind:checked={
					() => config.left.rotationEnabled,
					(isEnabled) => updateConfig('left', 'rotationEnabled', isEnabled)
				}
			/>
		</label>

		<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Right Controller</strong></h3>

		<div class="flex items-center justify-between gap-2">
			<span id="{uid}-right-arm">Arm</span>
			<Select
				aria-labelledby="{uid}-right-arm"
				placeholder="None"
				items={toSelectItems(rightAvailableArms)}
				bind:value={
					() => config.right.armName || '',
					(armName) => updateConfig('right', 'armName', armName || undefined)
				}
			/>
		</div>

		<div class="flex items-center justify-between gap-2">
			<span id="{uid}-right-gripper">Gripper</span>
			<Select
				aria-labelledby="{uid}-right-gripper"
				placeholder="None"
				items={toSelectItems(rightAvailableGrippers)}
				bind:value={
					() => config.right.gripperName || '',
					(gripperName) => updateConfig('right', 'gripperName', gripperName || undefined)
				}
			/>
		</div>

		<label class="flex items-center justify-between gap-2">
			Scale: {config.right.scaleFactor.toFixed(1)}
			<input
				class="w-20"
				type="range"
				min="0.1"
				max="3.0"
				step="0.1"
				value={config.right.scaleFactor}
				style="--value: {((config.right.scaleFactor - 0.1) / (3 - 0.1)) * 100}%"
				oninput={(e) =>
					updateConfig('right', 'scaleFactor', Number.parseFloat(e.currentTarget.value))}
			/>
		</label>

		<label class="flex items-center justify-between gap-2">
			Rotation
			<Switch
				bind:checked={
					() => config.right.rotationEnabled,
					(isEnabled) => updateConfig('right', 'rotationEnabled', isEnabled)
				}
			/>
		</label>
	</div>
</div>

<style>
	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		background: linear-gradient(
			to right,
			#3d7d3f 0%,
			#3d7d3f var(--value),
			#d1d5db var(--value),
			#d1d5db 100%
		);
		border-radius: 0.25rem;
		height: 0.5rem;
		cursor: pointer;
		outline: none;
	}

	input[type='range']::-webkit-slider-track {
		background: transparent;
		height: 0.5rem;
		border-radius: 0.25rem;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		background: #3d7d3f;
		height: 1.25rem;
		width: 1.25rem;
		border-radius: 50%;
		border: 2px solid white;
	}

	input[type='range']::-moz-range-track {
		background: transparent;
		height: 0.5rem;
		border-radius: 0.25rem;
	}

	input[type='range']::-moz-range-thumb {
		background: #3d7d3f;
		height: 1.25rem;
		width: 1.25rem;
		border-radius: 50%;
		border: 2px solid white;
	}

	input[type='range']::-moz-range-progress {
		background: #3d7d3f;
		height: 0.5rem;
		border-radius: 0.25rem;
	}
</style>
