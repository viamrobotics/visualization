<!--
@component

Dispatches the shortcuts contributed through `useHotkey`. Features declare bindings where their behavior lives; this component owns the one window listener and the policy deciding when any of them may fire.
-->
<script lang="ts">
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useHotkeys } from '$lib/hooks/useHotkeys.svelte'
	import { getHotkeyForKey } from '$lib/keybindings'

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

		const binding = getHotkeyForKey(event.key, event.shiftKey)
		if (binding === undefined) return

		const handlers = hotkeys.handlers.get(binding.id)
		if (handlers === undefined) return

		const applicable = [...handlers].filter((handler) => handler.when?.() ?? true)

		// One key means one action now, so a second applicable handler is two components
		// implementing the same shortcut rather than two features sharing a key.
		if (import.meta.env.DEV && applicable.length > 1) {
			console.warn(`[KeyboardBindings] ${applicable.length} components implement "${binding.id}"`)
		}

		for (const handler of applicable) {
			handler.run()
		}
	}
</script>

<svelte:window {onkeydown} />
