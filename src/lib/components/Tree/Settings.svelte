<script lang="ts">
	import { Select, Switch, Input } from '@viamrobotics/prime-core'
	import RefreshRate from '../RefreshRate.svelte'
	import { useMotionClient } from '$lib/hooks/useMotionClient.svelte'
	import Drawer from './Drawer.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useResourceNames } from '@viamrobotics/svelte-sdk'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useMachineSettings } from '$lib/hooks/useMachineSettings.svelte'

	const partID = usePartID()
	const cameras = useResourceNames(() => partID.current, 'camera')
	const settings = useSettings()
	const { disabledCameras } = useMachineSettings()
	const motionClient = useMotionClient()
</script>

<Drawer
	name="Settings"
	defaultOpen
>
	<div class="flex h-100 flex-col gap-2 overflow-scroll p-3">
		<h3 class="text-sm"><strong>Machine connection</strong></h3>

		<RefreshRate name="Geometries" />
		<RefreshRate name="Poses" />
		<RefreshRate name="Pointclouds" />
		<div>
			<div>Enabled pointcloud cameras</div>
			{#each cameras.current as camera (camera)}
				<div class="flex items-center justify-between gap-4 py-2">
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

		<label class="flex flex-col gap-1">
			Motion client
			<Select
				onchange={(event: InputEvent) => {
					if (event.target instanceof HTMLSelectElement) {
						motionClient.set(event.target.value)
					}
				}}
				value={motionClient.current}
			>
				{#each motionClient.names as name (name)}
					<option>{name}</option>
				{/each}
			</Select>
		</label>

		<h3 class="pt-2 text-sm"><strong>Pointclouds</strong></h3>
		<div class="flex flex-col gap-2.5">
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
		</div>

		<h3 class="pt-2 text-sm"><strong>Scene</strong></h3>
		<div class="flex flex-col gap-2.5">
			<label class="flex items-center justify-between gap-2">
				Object labels <Switch bind:on={settings.current.enableLabels} />
			</label>

			<label class="flex items-center justify-between gap-2">
				Grid <Switch bind:on={settings.current.grid} />
			</label>

			<label class="flex items-center justify-between gap-2">
				Grid cell size (m)

				<div class="w-20">
					<Input
						bind:value={settings.current.gridCellSize}
						on:keydown={(event) => event.stopImmediatePropagation()}
					/>
				</div>
			</label>

			<label class="flex items-center justify-between gap-2">
				Grid section size (m)

				<div class="w-20">
					<Input
						bind:value={settings.current.gridSectionSize}
						on:keydown={(event) => event.stopImmediatePropagation()}
					/>
				</div>
			</label>

			<label class="flex items-center justify-between gap-2">
				Grid fade distance (m)

				<div class="w-20">
					<Input
						bind:value={settings.current.gridFadeDistance}
						on:keydown={(event) => event.stopImmediatePropagation()}
					/>
				</div>
			</label>
		</div>

		<h3 class="pt-2 text-sm"><strong>Lines</strong></h3>
		<div class="flex flex-col gap-2.5">
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

		<h3 class="pt-2 text-sm"><strong>Misc</strong></h3>
		<div class="flex flex-col gap-2.5">
			<label class="flex items-center justify-between gap-2">
				Query devtools <Switch bind:on={settings.current.enableQueryDevtools} />
			</label>
			<label class="flex items-center justify-between gap-2">
				Render stats <Switch bind:on={settings.current.renderStats} />
			</label>
		</div>
	</div>
</Drawer>
