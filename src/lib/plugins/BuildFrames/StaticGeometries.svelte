<script
	module
	lang="ts"
>
	let index = 0
</script>

<script lang="ts">
	import type { Entity } from 'koota'

	import { SvelteSet } from 'svelte/reactivity'

	import { traits, useQuery, useWorld } from '$lib/ecs'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useHotkey } from '$lib/hooks/useHotkeys.svelte'

	const world = useWorld()
	const selected = useQuery(traits.Selected)
	const environment = useEnvironment()

	const isBuildMode = $derived(environment.current.mode === 'build')

	const entities = new SvelteSet<Entity>()
	const selectedCustomGeometry = $derived(
		[...entities].find((entity) => entity === selected.current[0])
	)

	useHotkey({
		key: '=',
		description: 'Add a custom geometry',
		when: () => isBuildMode,
		run: () => {
			const entity = world.spawn(
				traits.Name(`custom geometry ${++index}`),
				traits.Matrix,
				traits.Box({ x: 100, y: 100, z: 100 }),
				traits.Removable,
				traits.Editable
			)

			entities.add(entity)
		},
	})

	useHotkey({
		key: '-',
		description: 'Remove the selected custom geometry',
		when: () => selectedCustomGeometry !== undefined,
		run: () => {
			const entity = selectedCustomGeometry
			if (entity === undefined) return

			entity.destroy()
			entities.delete(entity)
		},
	})
</script>
