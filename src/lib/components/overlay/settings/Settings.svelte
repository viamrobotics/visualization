<script lang="ts">
	import { Switch, Input } from '@viamrobotics/prime-core'
	import { Portal } from '@threlte/extras'
	import RefreshRate from '../RefreshRate.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useResourceNames } from '@viamrobotics/svelte-sdk'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { RefreshRates, useMachineSettings } from '$lib/hooks/useMachineSettings.svelte'
	import { useGeometries } from '$lib/hooks/useGeometries.svelte'
	import { usePointClouds } from '$lib/hooks/usePointclouds.svelte'
	import { useThrelte } from '@threlte/core'
	import { useRefetchPoses } from '$lib/hooks/useRefetchPoses'
	import FloatingPanel from '../FloatingPanel.svelte'
	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import Tabs from './Tabs.svelte'
	import { PersistedState } from 'runed'
	import ToggleGroup from '../ToggleGroup.svelte'
	import XRControllerSettings from '$lib/components/xr/XRControllerSettings.svelte'

	const { invalidate } = useThrelte()
	const partID = usePartID()
	const cameras = useResourceNames(() => partID.current, 'camera')
	const visionServices = useResourceNames(() => partID.current, 'vision')
	const settings = useSettings()
	const { disabledCameras, disabledVisionServices } = useMachineSettings()
	const geometries = useGeometries()
	const pointclouds = usePointClouds()
	const { refetchPoses } = useRefetchPoses()

	// Invalidate the renderer for any settings change
	$effect(() => {
		for (const key in settings.current) {
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			settings.current[key as keyof typeof settings.current]
		}

		invalidate()
	})

	const isOpen = new PersistedState('settings-is-open', false)
	const activeTab = new PersistedState('settings-active-tab', 'Connection')
</script>

<Portal id="dashboard">
	<fieldset>
		<DashboardButton
			active
			icon="cog"
			description="Settings"
			onclick={() => {
				isOpen.current = !isOpen.current
			}}
		/>
	</fieldset>
</Portal>

{#snippet SectionTitle(title: string)}
	<h3 class="border-gray-3 border-b py-1 text-sm"><strong>{title}</strong></h3>
{/snippet}

{#snippet Connection()}
	<div class="flex flex-col gap-2.5 text-xs">
		{@render SectionTitle('Polling rates')}

		<RefreshRate
			id={RefreshRates.poses}
			label="Poses"
			allowLive
			onManualRefetch={() => {
				refetchPoses()
				geometries.refetch()
			}}
		/>
		<RefreshRate
			id={RefreshRates.pointclouds}
			label="Pointclouds"
			onManualRefetch={() => {
				pointclouds.refetch()
			}}
		/>
	</div>
{/snippet}

{#snippet Pointclouds()}
	<div class="flex flex-col gap-1 text-xs">
		<label class="flex items-center justify-between gap-2">
			Default point size

			<div class="w-20">
				<Input
					bind:value={settings.current.pointSize}
					on:keydown={(event) => event.stopImmediatePropagation()}
				/>
			</div>
		</label>

		<label class="flex items-center justify-between gap-2">
			Default point color

			<div class="w-20">
				<Input
					type="color"
					bind:value={settings.current.pointColor}
					on:keydown={(event) => event.stopImmediatePropagation()}
				/>
			</div>
		</label>

		{@render SectionTitle('Enabled cameras')}

		{#each cameras.current as camera (camera)}
			<div class="flex items-center justify-between py-0.5 text-xs">
				{camera.name}
				<Switch
					on={disabledCameras.get(camera.name) !== true}
					on:change={(event) => {
						disabledCameras.set(camera.name, !event.detail)
					}}
				/>
			</div>
		{:else}
			No cameras detected
		{/each}
	</div>
{/snippet}

{#snippet Vision()}
	<div class="text-gray-9 flex flex-col gap-1 text-xs">
		{@render SectionTitle('Enabled vision services')}

		{#each visionServices.current as visionService (visionService)}
			<div class="flex items-center justify-between py-0.5">
				{visionService.name}
				<Switch
					on={disabledVisionServices.get(visionService.name) !== true}
					on:change={(event) => {
						disabledVisionServices.set(visionService.name, !event.detail)
					}}
				/>
			</div>
		{:else}
			No vision services detected
		{/each}
	</div>
{/snippet}

{#snippet Scene()}
	<div class="text-gray-9 flex flex-col gap-1 text-xs">
		<label class="flex items-center justify-between gap-2 py-1">
			Arm Models

			<ToggleGroup
				multiple
				options={[
					{
						label: 'Colliders',
						value: 'colliders',
						selected: settings.current.renderArmModels.includes('colliders'),
					},
					{
						label: 'Model',
						value: 'model',
						selected: settings.current.renderArmModels.includes('model'),
					},
				]}
				onSelect={(value) => {
					settings.current.renderArmModels = (value.join('+') || 'colliders') as
						| 'colliders'
						| 'model'
						| 'colliders+model'

					console.log(settings.current.renderArmModels)
				}}
			/>
		</label>

		<label class="flex items-center justify-between gap-2">
			Single item hover details <Switch bind:on={settings.current.renderSubEntityHoverDetail} />
		</label>

		<label class="flex items-center justify-between gap-2">
			Object labels <Switch bind:on={settings.current.enableLabels} />
		</label>

		{@render SectionTitle('Grid')}

		<label class="flex items-center justify-between gap-2 py-1">
			Visible <Switch bind:on={settings.current.grid} />
		</label>

		<label class="flex items-center justify-between gap-2">
			Cell size (m)

			<div class="w-20">
				<Input
					bind:value={settings.current.gridCellSize}
					on:keydown={(event) => event.stopImmediatePropagation()}
				/>
			</div>
		</label>

		<label class="flex items-center justify-between gap-2">
			Section size (m)

			<div class="w-20">
				<Input
					bind:value={settings.current.gridSectionSize}
					on:keydown={(event) => event.stopImmediatePropagation()}
				/>
			</div>
		</label>

		<label class="flex items-center justify-between gap-2">
			Fade distance (m)

			<div class="w-20">
				<Input
					bind:value={settings.current.gridFadeDistance}
					on:keydown={(event) => event.stopImmediatePropagation()}
				/>
			</div>
		</label>

		{@render SectionTitle('Lines')}

		<label class="flex items-center justify-between gap-2">
			Thickness

			<div class="w-20">
				<Input
					bind:value={settings.current.lineWidth}
					on:keydown={(event) => event.stopImmediatePropagation()}
				/>
			</div>
		</label>

		<label class="flex items-center justify-between gap-2">
			Dot size

			<div class="w-20">
				<Input
					bind:value={settings.current.lineDotSize}
					on:keydown={(event) => event.stopImmediatePropagation()}
				/>
			</div>
		</label>
	</div>
{/snippet}

{#snippet Stats()}
	<div class="flex w-full flex-col gap-2.5 text-xs">
		<label class="flex items-center justify-between gap-2">
			Query devtools <Switch bind:on={settings.current.enableQueryDevtools} />
		</label>

		<label class="flex items-center justify-between gap-2">
			Render stats <Switch bind:on={settings.current.renderStats} />
		</label>
	</div>
{/snippet}

{#snippet XR()}
	<div class="flex flex-col gap-2.5 text-xs">
		<XRControllerSettings />
	</div>
{/snippet}

<FloatingPanel
	title="Settings"
	bind:isOpen={isOpen.current}
	defaultSize={{ width: 460, height: 500 }}
>
	<Tabs
		defaultTab={activeTab.current}
		items={[
			{ label: 'Connection', content: Connection },
			{ label: 'Scene', content: Scene },
			{ label: 'Pointclouds', content: Pointclouds },
			{ label: 'Vision', content: Vision },
			{ label: 'Stats', content: Stats },
			...('xr' in navigator ? [{ label: 'VR / AR', content: XR }] : []),
		]}
		onValueChange={(value) => {
			activeTab.current = value
		}}
	/>
</FloatingPanel>
