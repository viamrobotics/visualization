<script lang="ts">
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { obstacleEditorType } from '$lib/obstacleEditorType'

	import BoundsObstacleEditor from './BoundsObstacleEditor.svelte'
	import ComplexObstacleEditor from './ComplexObstacleEditor.svelte'
	import SimpleObstacleEditor from './SimpleObstacleEditor.svelte'

	interface Props {
		/** Name of the part-owned obstacle component to edit. */
		name: string
	}

	const { name }: Props = $props()

	const partConfig = usePartConfig()

	const component = $derived(partConfig.current?.components?.find((entry) => entry.name === name))
	const editorType = $derived(component ? obstacleEditorType(component) : undefined)
</script>

{#if component && editorType === 'simple'}
	<div
		role="group"
		aria-label="obstacle shape"
	>
		<SimpleObstacleEditor {component} />
	</div>
{:else if component && editorType === 'bounds'}
	<div
		role="group"
		aria-label="obstacle bounds"
	>
		<BoundsObstacleEditor {component} />
	</div>
{:else if component && editorType === 'complex'}
	<div
		role="group"
		aria-label="obstacle geometries"
	>
		<ComplexObstacleEditor {component} />
	</div>
{/if}
