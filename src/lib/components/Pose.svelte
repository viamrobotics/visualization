<script lang="ts">
	import { usePose } from '$lib/hooks/usePose.svelte'
	import type { Pose } from '@viamrobotics/sdk'
	import type { Snippet } from 'svelte'

	interface Props {
		name: string
		parent?: string
		children: Snippet<[{ pose: Pose | undefined }]>
	}
	let { name, parent, children }: Props = $props()

	const pose = usePose(
		() => name,
		() => parent ?? 'world'
	)
</script>

{@render children({ pose: pose.current })}
