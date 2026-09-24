<script lang="ts">
	import { Expandable, Icon } from '@viamrobotics/prime-core'
	import { CodeEditor } from '@viamrobotics/prime-core/code-editor'

	interface Props {
		label: string
		value: string
		onChange: (next: string) => void
	}

	const { label, value, onChange }: Props = $props()

	let open = $state(false)
</script>

{#snippet trigger({ isOpen }: { isOpen: boolean })}
	<span class="flex w-full items-center gap-1">
		<Icon
			name={isOpen ? 'chevron-down' : 'chevron-right'}
			aria-hidden="true"
		/>
		<strong class="font-semibold">{label}</strong>
		<span class="text-subtle-2">(optional JSON)</span>
	</span>
{/snippet}

{#snippet content()}
	<!-- CodeMirror measures itself on mount, so keep it out of the collapsed panel. -->
	{#if open}
		<CodeEditor
			{label}
			{value}
			{onChange}
			language="json"
			class="mt-1 h-32 overflow-y-auto"
		/>
	{/if}
{/snippet}

<Expandable
	bind:open
	{trigger}
	{content}
	triggerClass="w-full text-left"
/>
