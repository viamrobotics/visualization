<script lang="ts">
	import { Hand } from '@threlte/xr'

	const onpinchstart = () => {
		// Pinch started
	}

	const onpinchend = () => {
		// Pinch ended
	}
</script>

<Hand
	left
	{onpinchstart}
	{onpinchend}
></Hand>

<Hand
	right
	{onpinchstart}
	{onpinchend}
></Hand>
