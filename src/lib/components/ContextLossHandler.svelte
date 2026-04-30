<script lang="ts">
	import { useThrelte } from '@threlte/core'

	const { renderer, invalidate } = useThrelte()
	const canvas = renderer.domElement

	const onContextLost = (event: Event) => {
		event.preventDefault()
		console.warn('WebGL context lost — waiting for browser to restore it.')
	}

	const onContextRestored = () => {
		console.warn('WebGL context restored — re-rendering scene.')
		invalidate()
	}

	$effect(() => {
		canvas.addEventListener('webglcontextlost', onContextLost)
		canvas.addEventListener('webglcontextrestored', onContextRestored)

		return () => {
			canvas.removeEventListener('webglcontextlost', onContextLost)
			canvas.removeEventListener('webglcontextrestored', onContextRestored)
		}
	})
</script>
