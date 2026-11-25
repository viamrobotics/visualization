<script lang="ts">
	interface Props {
		partID: string
		resourceName: string
	}

	const { partID, resourceName }: Props = $props()
</script>

<div>dummy:{partID}:{resourceName}</div>
