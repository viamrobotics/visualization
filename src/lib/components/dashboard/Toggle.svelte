<script lang="ts">
	import { Tooltip } from '@viamrobotics/prime-core'

	interface Props {
		onValue: string
		offValue: string
		active?: boolean
		description: string
		hotkey?: string
		class?: string
		onclick?: () => void
	}

	let {
		onValue,
		offValue,
		active = false,
		description,
		hotkey = '',
		class: className = '',
		onclick,
	}: Props = $props()
</script>

<Tooltip
	let:tooltipID
	location="bottom"
>
	<label
		class={[
			className,
			'relative block cursor-pointer rounded-full border px-3 py-1.5 transition-all duration-200',
			active
				? 'border-gray-5 bg-gray-8 text-white'
				: 'bg-light border-medium text-disabled hover:border-gray-4',
		]}
		aria-describedby={tooltipID}
	>
		<input
			type="checkbox"
			class="sr-only"
			checked={active}
			aria-label={description}
			onchange={onclick}
		/>
		<div class="flex items-center gap-2 text-xs font-medium">
			<div
				class={[
					'relative h-4 w-7 rounded-full border transition-all duration-200',
					active ? 'border-white bg-white' : 'border-current bg-transparent',
				]}
			>
				<div
					class={[
						'absolute top-0.5 h-3 w-3 rounded-full transition-all duration-200',
						active ? 'bg-gray-8 left-3.5' : 'left-0.5 bg-current',
					]}
				></div>
			</div>
			{active ? onValue : offValue}
		</div>
	</label>
	<p slot="description">
		{description} <span class="text-gray-5 pl-1">{hotkey}</span>
	</p>
</Tooltip>
