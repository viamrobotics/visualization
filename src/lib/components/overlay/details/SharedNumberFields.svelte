<!--
@component

A row of number fields for values shared across a selection. Unlike prime-controls `Point`, the
row never stacks its axes, so it fits the narrow details panel on one line.
A mixed field stays empty with a dash placeholder until typed into, and an edit reports only the
field it changed, so every selected entity keeps its own value for the others.
-->
<script
	lang="ts"
	generics="TKey extends string"
>
	import { NumberField } from '@viamrobotics/prime-controls'

	import { MIXED, MIXED_TEXT, type Shared } from './sharedValue'

	interface Field {
		key: TKey
		/** The inset label, such as `X`. */
		label: string
	}

	interface Props {
		/** Names the row for assistive technology. */
		'aria-label': string
		fields: readonly Field[]
		values: Readonly<Record<TKey, Shared<number>>>
		/** Called with the one field the user changed. */
		onchange: (patch: Partial<Record<TKey, number>>) => void
		min?: number
		step?: number
		disabled?: boolean
	}

	const {
		'aria-label': ariaLabel,
		fields,
		values,
		onchange,
		min,
		step = 1,
		disabled,
	}: Props = $props()

	const valueOf = (key: TKey): Shared<number> => values[key]
</script>

<div
	role="group"
	aria-label={ariaLabel}
	class="grid auto-cols-fr grid-flow-col gap-1"
>
	{#each fields as field (field.key)}
		{@const value = valueOf(field.key)}
		<NumberField
			label={field.label}
			labelPlacement="inset"
			{min}
			{step}
			{disabled}
			placeholder={value === MIXED ? MIXED_TEXT : undefined}
			class="min-w-0"
			bind:value={
				() => (value === MIXED ? undefined : value),
				(next) => {
					if (next !== undefined) {
						onchange({ [field.key]: next } as Partial<Record<TKey, number>>)
					}
				}
			}
		/>
	{/each}
</div>
