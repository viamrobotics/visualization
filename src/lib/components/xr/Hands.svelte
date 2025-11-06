<script lang="ts">
	import { Hand } from '@threlte/xr'

	console.log('hands')

	const onpinchstart = () => {
		console.log('start')
	}

	const onpinchend = () => {
		console.log('end')
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
