<script lang="ts">
	interface Props {
		isFilled: boolean
	}

	const { isFilled }: Props = $props()

	// MDI's star and star-outline, which prime's icon set lacks. Same paths as app.viam.com's Star.
	const FILLED_PATH =
		'M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z'
	const OUTLINE_PATH =
		'M12,15.39L8.24,17.66L9.23,13.38L5.91,10.5L10.29,10.13L12,6.09L13.71,10.13L18.09,10.5L14.77,13.38L15.76,17.66L12,15.39M22,9.24L14.81,8.63L12,2L9.19,8.63L2,9.24L7.45,13.97L5.82,21L12,17.27L18.18,21L16.54,13.97L22,9.24Z'
</script>

<svg
	class="size-4"
	viewBox="0 0 24 24"
	fill="currentColor"
	aria-hidden="true"
>
	<path d={isFilled ? FILLED_PATH : OUTLINE_PATH} />
</svg>
