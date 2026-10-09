<script lang="ts">
	import type { KeybindingGroup } from '#lib/keybindings/index.js'

	import Kbd from '#lib/components/overlay/Kbd.svelte'
	import { useKeybindings } from '#lib/keybindings/index.js'

	const GROUP_ORDER: KeybindingGroup[] = ['Camera', 'Transform', 'View', 'Selection', 'Editing']

	const keybindings = useKeybindings()

	const groups = $derived(
		GROUP_ORDER.map((group) => ({
			group,
			bindings: keybindings.bindings.filter((binding) => binding.group === group),
		})).filter(({ bindings }) => bindings.length > 0)
	)
</script>

<div class="text-gray-9 flex flex-col gap-4 text-xs">
	{#each groups as { group, bindings } (group)}
		<section class="flex flex-col gap-1">
			<h3 class="border-gray-3 border-b py-1 text-sm"><strong>{group}</strong></h3>

			{#each bindings as binding (binding.id)}
				<div class="flex items-center justify-between gap-4 py-1">
					<span>{binding.description}</span>

					<Kbd {binding} />
				</div>
			{/each}
		</section>
	{/each}
</div>
