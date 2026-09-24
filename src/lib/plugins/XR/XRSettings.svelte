<script lang="ts">
	import { Select, Switch } from '@viamrobotics/prime-core'
	import { useResourceStatuses } from '@viamrobotics/svelte-sdk'

	import { useArmClient } from '$lib/hooks/useArmClient.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()
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
			Enable VR / AR mode <Switch bind:on={settings.current.enableXR} />
		</label>

		<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Cameras</strong></h3>

		{#if cameraNames.length === 0}
			<p class="text-subtle-2">No cameras on this machine.</p>
		{:else}
			{#each cameraNames as name (name)}
				<label class="flex items-center justify-between gap-2">
					{name}
					<Switch
						on={settings.current.xrCameras.includes(name)}
						on:change={(event) => {
							toggleCamera(name, event.detail)
						}}
					/>
				</label>
			{/each}
		{/if}

		<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Left Controller</strong></h3>

		<label class="flex items-center justify-between gap-2">
			Arm
			<Select
				value={config.left.armName || ''}
				onchange={(event: Event) => {
					if (event.target instanceof HTMLSelectElement) {
						updateConfig('left', 'armName', event.target.value || undefined)
					}
				}}
			>
				<option value="">None</option>
				{#each leftAvailableArms as armName (armName)}
					<option value={armName}>{armName}</option>
				{/each}
			</Select>
		</label>

		<label class="flex items-center justify-between gap-2">
			Gripper
			<Select
				value={config.left.gripperName || ''}
				onchange={(event: Event) => {
					if (event.target instanceof HTMLSelectElement) {
						updateConfig('left', 'gripperName', event.target.value || undefined)
					}
				}}
			>
				<option value="">None</option>
				{#each leftAvailableGrippers as gripperName (gripperName)}
					<option value={gripperName}>{gripperName}</option>
				{/each}
			</Select>
		</label>

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
				on={config.left.rotationEnabled}
				on:change={(event) => {
					updateConfig('left', 'rotationEnabled', event.detail)
				}}
			/>
		</label>

		<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Right Controller</strong></h3>

		<label class="flex items-center justify-between gap-2">
			Arm
			<Select
				value={config.right.armName || ''}
				onchange={(event: Event) => {
					if (event.target instanceof HTMLSelectElement) {
						updateConfig('right', 'armName', event.target.value || undefined)
					}
				}}
			>
				<option value="">None</option>
				{#each rightAvailableArms as armName (armName)}
					<option value={armName}>{armName}</option>
				{/each}
			</Select>
		</label>

		<label class="flex items-center justify-between gap-2">
			Gripper
			<Select
				value={config.right.gripperName || ''}
				onchange={(event: Event) => {
					if (event.target instanceof HTMLSelectElement) {
						updateConfig('right', 'gripperName', event.target.value || undefined)
					}
				}}
			>
				<option value="">None</option>
				{#each rightAvailableGrippers as gripperName (gripperName)}
					<option value={gripperName}>{gripperName}</option>
				{/each}
			</Select>
		</label>

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
				on={config.right.rotationEnabled}
				on:change={(event) => {
					updateConfig('right', 'rotationEnabled', event.detail)
				}}
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
