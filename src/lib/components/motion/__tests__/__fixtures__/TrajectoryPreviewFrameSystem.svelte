<script
	module
	lang="ts"
>
	import type { robotApi } from '@viamrobotics/sdk'

	let parts = $state.raw<robotApi.FrameSystemConfig[] | undefined>(undefined)
	let isLoading = $state(false)

	/**
	 * Stands in for the scene's `frameSystemConfig` robot query. Reactive, so a spec can load a frame
	 * system after the scene mounts.
	 */
	export const frameSystemQuery = {
		get data() {
			return parts
		},
		error: undefined,
		get isFetching() {
			return isLoading
		},
		get isLoading() {
			return isLoading
		},
	}

	/** What the stubbed query answers with from now on. `undefined` is a query with no reply yet. */
	export const setFrameSystem = (
		next: robotApi.FrameSystemConfig[] | undefined,
		{ isLoading: loading = false } = {}
	) => {
		parts = next
		isLoading = loading
	}
</script>
