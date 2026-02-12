<script lang="ts">
	import { HTML } from '@threlte/extras'
	import { type HoverInfo } from '$lib/HoverUpdater.svelte'

	interface Props {
		hoverInfo: HoverInfo
	}

	let { hoverInfo }: Props = $props()
</script>

{#if hoverInfo?.position}
	<HTML
		position={[hoverInfo.position.x, hoverInfo.position.y, hoverInfo.position.z]}
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
							<span class="text-subtle-2 mr-1">x </span>{hoverInfo.position.x.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2 mr-1">y </span>{hoverInfo.position.y.toFixed(2)}
						</div>
						<div>
							<span class="text-subtle-2 mr-1">z </span>{hoverInfo.position.z.toFixed(2)}
						</div>
					</div>
				</div>

				{#if hoverInfo.orientation}
					<div>
						<div class="mb-1">
							<strong class="font-semibold">world orientation</strong>
							<span class="text-subtle-2"> (deg)</span>
						</div>
						<div class="flex gap-3">
							<div>
								<span class="text-subtle-2 mr-1">x </span>{hoverInfo.orientation?.x.toFixed(2)}
							</div>
							<div>
								<span class="text-subtle-2 mr-1">y </span>{hoverInfo.orientation?.y.toFixed(2)}
							</div>
							<div>
								<span class="text-subtle-2 mr-1">z </span>{hoverInfo.orientation?.z.toFixed(2)}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</HTML>
{/if}
