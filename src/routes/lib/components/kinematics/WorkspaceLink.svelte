<script lang="ts">
	import { Icon, type IconName } from '@viamrobotics/prime-core'

	import { resolve } from '$app/paths'
	import { WorkspacePortal } from '$lib'

	interface Props {
		/** A route of this app, resolved against the base path here. */
		route: '/' | '/kinematics'
		label: string
		icon: IconName
	}

	let { route, label, icon }: Props = $props()
</script>

<WorkspacePortal>
	<a
		href={resolve(route)}
		class="border-gray-5 text-default hover:bg-gray-1 focus-visible:bg-gray-1 active:bg-gray-2 flex items-center gap-2 rounded border bg-white px-2.5 py-1.5 text-xs"
	>
		<Icon name={icon} />
		<span class="whitespace-nowrap">{label}</span>
	</a>
</WorkspacePortal>
