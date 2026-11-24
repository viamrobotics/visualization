<script lang="ts">
	import { mdiAlert, mdiAlertCircle } from '@mdi/js'
	import { Icon, Tooltip } from '@viamrobotics/prime-ui'

	import type { traits } from '#lib/ecs/index.js'

	interface Props {
		/** Row name, for the tooltip heading and the icon's accessible name. */
		label: string
		issues: ReadonlyMap<string, traits.IssueLine[]>
	}

	let { label, issues }: Props = $props()

	const lines = $derived([...issues.values()].flat())
	const errorCount = $derived(lines.filter((line) => line.severity === 'error').length)
	const warnCount = $derived(lines.length - errorCount)
	const isError = $derived(errorCount > 0)

	const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

	const summary = $derived(
		[errorCount > 0 && plural(errorCount, 'error'), warnCount > 0 && plural(warnCount, 'warning')]
			.filter(Boolean)
			.join(' and ')
	)

	/** A writer's key, `missing-parent`, read as a heading, `Missing parent`. */
	const sourceHeading = (key: string): string => {
		const words = key.replaceAll('-', ' ')
		return words.charAt(0).toUpperCase() + words.slice(1)
	}
</script>

<!--
	Opens to the side, not below: the tree is a 240px panel of 32px rows, so a
	bottom-placed tooltip covers the rows underneath the one it is explaining.
	Interactive so a long message can be reached and copied.
-->
<Tooltip
	interactive
	openDelay={150}
>
	<Tooltip.Trigger class="inline-flex items-center">
		<span
			class={[
				'flex size-4 shrink-0 items-center justify-center rounded-sm text-white',
				isError ? 'bg-danger-bright' : 'bg-warning-bright',
			]}
			role="img"
			aria-label="{label} has {summary}"
		>
			<Icon
				icon={isError ? mdiAlertCircle : mdiAlert}
				size="xs"
			/>
		</span>
	</Tooltip.Trigger>

	<Tooltip.Content side="right">
		<div class="font-public-sans flex flex-col gap-1.5">
			<p class="font-roboto-mono text-gray-4">{label}</p>

			{#each issues as [key, sourceLines] (key)}
				<section class="flex flex-col gap-1">
					<p class="font-medium">{sourceHeading(key)}</p>

					<ul class="flex flex-col gap-1">
						{#each sourceLines as line, index (index)}
							<li class="flex items-start gap-1.5">
								<span
									class={[
										'mt-1 size-1.5 shrink-0 rounded-full',
										line.severity === 'error' ? 'bg-danger-bright' : 'bg-warning-bright',
									]}
									aria-hidden="true"
								></span>

								<span>
									{line.message}
									{#if line.count !== undefined && line.count > 1}
										<span class="text-gray-4">×{line.count}</span>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	</Tooltip.Content>
</Tooltip>
