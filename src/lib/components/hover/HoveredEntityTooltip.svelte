<script lang="ts">
	import { HTML } from '@threlte/extras'
	import { type HoverInfo } from '$lib/HoverUpdater.svelte'

	interface Props {
		hoverInfo: HoverInfo
	}

	let { hoverInfo }: Props = $props()
</script>

{#if hoverInfo}
	<HTML
		position={[hoverInfo.x, hoverInfo.y, hoverInfo.z]}
		class="pointer-events-none"
		zIndexRange={[3, 0]}
	>
		<div
			class="border-medium pointer-events-none relative -mb-2 -translate-x-1/2 -translate-y-full border bg-white px-3 py-2.5 text-xs shadow-md"
		>
			<!-- Arrow -->
			<div
				class="border-medium absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-r border-b bg-white"
			></div>

			<div class="flex flex-col gap-2.5">
				<div>
					<div class="mb-1"><strong class="font-semibold">index</strong></div>
					<div>{hoverInfo.index}</div>
				</div>

				<div>
					<div class="mb-1">
						<strong class="font-semibold">world position</strong>
						<span class="text-subtle-2"> (m)</span>
					</div>
					<div class="flex gap-3">
						<div>
							<span class="text-subtle-2 mr-1">x </span>{hoverInfo.x.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2 mr-1">y </span>{hoverInfo.y.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2 mr-1">z </span>{hoverInfo.z.toFixed(2)}
						</div>
					</div>
				</div>

				<div>
					<div class="mb-1">
						<strong class="font-semibold">world orientation</strong>
						<span class="text-subtle-2"> (deg)</span>
					</div>
					<div class="flex gap-3">
						<div>
							<span class="text-subtle-2 mr-1">x </span>{hoverInfo.ox.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2 mr-1">y </span>{hoverInfo.oY.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2 mr-1">z </span>{hoverInfo.oZ.toFixed(2)}
						</div>
					</div>
				</div>
			</div>
		</div>
	</HTML>
{/if}
