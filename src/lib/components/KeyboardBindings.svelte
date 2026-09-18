<!--
@component

Dispatches the shortcuts contributed through `useHotkey`. Features declare bindings where their behavior lives; this component owns the one window listener and the policy deciding when any of them may fire.
-->
<script lang="ts">
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useHotkeys } from '$lib/hooks/useHotkeys.svelte'

	const environment = useEnvironment()
	const hotkeys = useHotkeys()

	const isEditable = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		(target.isContentEditable || target.closest('input, textarea, select') !== null)

	const onkeydown = (event: KeyboardEvent) => {
		if (!environment.current.inputBindingsEnabled) return
		// Modified presses belong to the browser (cmd+c) or to handlers with their
		// own modifier semantics; repeats would re-fire toggles while a key is held.
		if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
		if (isEditable(event.target)) return

		const bindings = hotkeys.bindings.get(event.key.toLowerCase())
		if (bindings === undefined) return

		const applicable = [...bindings].filter((binding) => binding.when?.() ?? true)

		if (import.meta.env.DEV && applicable.length > 1) {
			console.warn(
				`[KeyboardBindings] ${applicable.length} bindings apply to "${event.key}": ` +
					applicable.map((binding) => binding.description).join(', ')
			)
		}

		// Suppress the default before dispatch, so a binding whose `run` throws still
		// prevented the browser action it opted out of.
		if (applicable.some((binding) => binding.preventDefault)) {
			event.preventDefault()
		}

		for (const binding of applicable) {
			binding.run()
		}
	}
</script>

<svelte:window {onkeydown} />
