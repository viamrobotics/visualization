<!--
@component

A row of number fields for values shared across a selection, laid out like prime-controls `Point`.
A mixed field stays empty with a dash placeholder until typed into, and an edit reports only the
field it changed, so every selected entity keeps its own value for the others.
-->
<script
	lang="ts"
	generics="TKey extends string"
>
	import { NumberField } from '@viamrobotics/prime-controls'
	import { SvelteSet } from 'svelte/reactivity'

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
	}

	const { 'aria-label': ariaLabel, fields, values, onchange, min, step = 1 }: Props = $props()

	const valueOf = (key: TKey): Shared<number> => values[key]

	// A cleared field writes nothing, so it would snap back to its value mid-retype. It is held
	// empty here instead, until a number is typed or the field loses focus. Same as `Point`.
	const clearedKeys = new SvelteSet<TKey>()

	const shownValue = (key: TKey): number | undefined => {
		const value = valueOf(key)
		return clearedKeys.has(key) || value === MIXED ? undefined : value
	}

	const write = (key: TKey, next: number | undefined) => {
		if (next === undefined) {
			clearedKeys.add(key)
			return
		}
		clearedKeys.delete(key)
		onchange({ [key]: next } as Partial<Record<TKey, number>>)
	}
</script>

<div
	role="group"
	aria-label={ariaLabel}
	class="grid auto-cols-fr grid-flow-col gap-1"
>
	{#each fields as field (field.key)}
		<NumberField
			label={field.label}
			labelPlacement="inset"
			{min}
			{step}
			placeholder={valueOf(field.key) === MIXED ? MIXED_TEXT : undefined}
			class="min-w-0"
			onblur={() => clearedKeys.delete(field.key)}
			bind:value={() => shownValue(field.key), (next) => write(field.key, next)}
		/>
	{/each}
</div>
