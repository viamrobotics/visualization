<script lang="ts">
	import { getContext } from 'svelte'

	import { SOURCE_LABEL_KEY } from './sourceLabelKey'
</script>

<p>{getContext<string>(SOURCE_LABEL_KEY)}</p>
