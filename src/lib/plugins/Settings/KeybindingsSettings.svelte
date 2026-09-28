<script lang="ts">
	import type { Keybinding, KeybindingGroup } from '$lib/keybindings'

	import Kbd from '$lib/components/overlay/Kbd.svelte'
	import { useKeybindings } from '$lib/keybindings'

	const GROUP_ORDER: KeybindingGroup[] = ['Camera', 'Transform', 'View', 'Selection', 'Editing']

	const keybindings = useKeybindings()

	// Two components can announce one shortcut, such as a gesture both selection tools
	// honour, and it should be listed once.
	const unique = $derived([
		...new Map(keybindings.bindings.map((binding) => [binding.id, binding])).values(),
	])

	const groups = $derived(
		GROUP_ORDER.map((group) => ({
			group,
			bindings: unique.filter((binding) => binding.group === group),
		})).filter(({ bindings }) => bindings.length > 0)
	)

	const isFixed = (binding: Keybinding) => binding.kind === 'fixed'
</script>

<div class="text-gray-9 flex flex-col gap-4 text-xs">
	{#each groups as { group, bindings } (group)}
		<section class="flex flex-col gap-1">
			<h3 class="border-gray-3 border-b py-1 text-sm"><strong>{group}</strong></h3>

			{#each bindings as binding (binding.id)}
				<div class="flex items-center justify-between gap-4 py-1">
					<span class={isFixed(binding) ? 'text-subtle-1' : ''}>{binding.description}</span>

					<Kbd {binding} />
				</div>
			{/each}
		</section>
	{/each}
</div>
