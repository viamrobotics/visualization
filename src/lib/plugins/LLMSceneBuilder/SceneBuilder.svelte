<script lang="ts">
	import { Icon } from '@viamrobotics/prime-core'

	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import FloatingPanel from '$lib/components/overlay/FloatingPanel.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'

	import DiffHeaderLabel from './DiffHeaderLabel.svelte'
	import { useSceneBuilder } from './useSceneBuilder.svelte'

	const sceneBuilder = useSceneBuilder()
	const environment = useEnvironment()

	const isBuildMode = $derived(environment.current.mode === 'build')

	let isOpen = $state(false)
	let prompt = $state('')

	const canSubmit = $derived(prompt.trim().length > 0 && sceneBuilder.uiState === 'idle')
</script>

{#if isBuildMode}
	<DashboardPortal>
		<fieldset>
			<DashboardButton
				active={isOpen}
				icon="robot-outline"
				description="LLM Scene Builder"
				onclick={() => (isOpen = !isOpen)}
			/>
		</fieldset>
	</DashboardPortal>

	<FloatingPanel
		bind:isOpen
		title="LLM Scene Builder"
		defaultSize={{ width: 480, height: 420 }}
		minSize={{ width: 360, height: 240 }}
		resizable
	>
		<div class="flex h-full min-h-0 min-w-0 flex-col gap-3 p-3 text-xs">
			<div class="flex min-w-0 gap-2">
				<textarea
					class="min-w-0 flex-1 resize-none rounded border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
					placeholder="Describe a frame change — translation, rotation, or parent. e.g. 'Move arm 200mm forward and rotate 90° left'"
					rows={3}
					disabled={sceneBuilder.uiState === 'loading' || sceneBuilder.uiState === 'diff'}
					bind:value={prompt}
					onkeydown={(e) => {
						e.stopImmediatePropagation()
						if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
							e.preventDefault()
							sceneBuilder.submit(prompt)
							prompt = ''
						}
					}}
				></textarea>
				<button
					class="shrink-0 self-end rounded bg-gray-800 px-3 py-1.5 text-xs text-nowrap text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
					disabled={!canSubmit}
					onclick={() => {
						sceneBuilder.submit(prompt)
						prompt = ''
					}}
				>
					Submit
				</button>
			</div>

			{#if sceneBuilder.uiState === 'loading'}
				<p class="text-gray-5 text-center">Thinking…</p>
			{/if}

			{#if sceneBuilder.uiState === 'diff'}
				<div class="flex min-h-0 flex-1 flex-col gap-3">
					{#if sceneBuilder.diffGroups.length > 0}
						<div class="min-h-0 flex-1 overflow-auto">
							<div class="flex flex-col gap-2">
								{#each sceneBuilder.diffGroups as group (group.componentName)}
									<div class="flex min-w-0 flex-col gap-1">
										<div class="flex min-w-0 items-center gap-1.5 px-2 py-1">
											<DiffHeaderLabel
												text={group.componentName}
												containerClass={group.explanation
													? 'max-w-[45%] shrink-0'
													: 'min-w-0 flex-1'}
												class="font-mono font-medium"
											/>
											{#if group.explanation}
												<span
													class="text-gray-5 shrink-0"
													aria-hidden="true">·</span
												>
												<DiffHeaderLabel
													text={group.explanation}
													containerClass="min-w-0 flex-1"
													class="text-gray-5 italic"
												/>
											{/if}
										</div>
										<div class="rounded border border-gray-200">
											<table class="w-full text-left">
												<thead>
													<tr class="border-b border-gray-200 bg-gray-50">
														<th class="text-subtle-1 px-2 py-1 font-normal">Field</th>
														<th class="text-subtle-1 px-2 py-1 font-normal">Old</th>
														<th class="text-subtle-1 px-2 py-1 font-normal">New</th>
													</tr>
												</thead>
												<tbody>
													{#each group.changes as change (change.field)}
														<tr class="border-t border-gray-100 first:border-t-0">
															<td class="px-2 py-1 font-mono">{change.field}</td>
															<td class="bg-danger-light text-danger-dark px-2 py-1 font-mono"
																>{change.oldValue}</td
															>
															<td class="bg-success-light text-success-dark px-2 py-1 font-mono"
																>{change.newValue}</td
															>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<p class="text-gray-5 text-center">No frame changes proposed.</p>
					{/if}

					{#if sceneBuilder.updateErrors.length > 0}
						<div class="border-danger-medium bg-danger-light shrink-0 rounded border p-2">
							<ul class="text-danger-dark space-y-0.5">
								{#each sceneBuilder.updateErrors as err (err.componentName)}
									<li class="flex min-w-0 gap-1">
										<span
											class="min-w-0 flex-1 overflow-hidden font-mono text-nowrap text-ellipsis"
											title={err.componentName}>{err.componentName}</span
										><span class="shrink-0">:</span><span>{err.reason}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<div class="mt-auto flex shrink-0 gap-2">
						<button
							class="rounded bg-gray-800 px-3 py-1.5 text-white hover:bg-gray-700"
							onclick={sceneBuilder.confirm}
						>
							Apply
						</button>
						<button
							class="rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
							onclick={sceneBuilder.cancel}
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			{#if sceneBuilder.uiState === 'error'}
				<div class="border-danger-medium bg-danger-light flex flex-col gap-2 rounded border p-2.5">
					<div class="text-danger-dark flex items-center gap-1.5 font-medium">
						<Icon
							name="alert-circle-outline"
							aria-hidden="true"
						/>
						Error
					</div>
					<p class="text-danger-dark">{sceneBuilder.errorMessage}</p>
					<button
						class="border-danger-medium text-danger-dark self-start rounded border px-3 py-1.5 hover:bg-[#F8E1DF]"
						onclick={sceneBuilder.resetError}
					>
						Try again
					</button>
				</div>
			{/if}
		</div>
	</FloatingPanel>
{/if}
