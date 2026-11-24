<script lang="ts">
	import { Tooltip } from '@viamrobotics/prime-ui'

	import type { IssueRollup } from './buildTree'

	interface Props {
		/** Row name, for the icon's accessible name. */
		label: string
		rollup: IssueRollup
	}

	let { label, rollup }: Props = $props()

	const isError = $derived(rollup.severity === 'error')
	const summary = $derived(
		rollup.count === 1 ? '1 item inside has issues' : `${rollup.count} items inside have issues`
	)
</script>

<!-- Smaller than a row's own badge, since it only points at rows the collapse is hiding. -->
<Tooltip openDelay={150}>
	<Tooltip.Trigger class="inline-flex size-4 items-center justify-center">
		<span
			class={['size-2 shrink-0 rounded-full', isError ? 'bg-danger-bright' : 'bg-warning-bright']}
			role="img"
			aria-label="{label}: {summary}"
		></span>
	</Tooltip.Trigger>

	<Tooltip.Content side="right">
		<p class="font-public-sans">{summary}</p>
	</Tooltip.Content>
</Tooltip>
