<script lang="ts">
	interface Props {
		partID: string
		resourceName: string
		frameName: string
		destination: string
	}

	const { partID, resourceName, frameName, destination }: Props = $props()
</script>

<div data-testid="move-widget">move:{partID}:{resourceName}:{frameName}:{destination}</div>
