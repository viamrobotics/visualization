<script>
	import DomPortalTarget from '../Portals/DomPortalTarget.svelte'

	let { ...rest } = $props()
</script>

<!-- Full width only to center the buttons, so the space between them passes input through to the canvas. -->
<div
	class="pointer-events-none absolute top-2 z-4 flex w-full items-center justify-center gap-2"
	{...rest}
>
	<!-- `contents` keeps the portaled buttons as flex items. `pointer-events` still inherits through it. -->
	<div class="pointer-events-auto contents">
		<DomPortalTarget id="dashboard" />
	</div>
</div>
