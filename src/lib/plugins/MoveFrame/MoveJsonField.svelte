<script lang="ts">
	import { CodeEditor } from '@viamrobotics/prime-editor'
	import { Collapsible } from '@viamrobotics/prime-ui'

	interface Props {
		label: string
		value: string
		onChange: (next: string) => void
	}

	const { label, value, onChange }: Props = $props()

	let open = $state(false)
</script>

<Collapsible bind:open>
	<Collapsible.Trigger>
		<span class="flex items-center gap-1">
			<strong class="font-semibold">{label}</strong>
			<span class="text-subtle-2">(optional JSON)</span>
		</span>
	</Collapsible.Trigger>
	<!-- CodeMirror measures itself on mount, and Collapsible.Content only mounts while open. -->
	<Collapsible.Content>
		<CodeEditor
			aria-label={label}
			bind:value={() => value, (next) => onChange(next)}
			language="json"
			class="mt-1 h-32 overflow-y-auto"
		/>
	</Collapsible.Content>
</Collapsible>
