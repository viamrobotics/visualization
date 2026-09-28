<!--
@component

Dispatches the shortcuts contributed through `useHotkey`. Features declare bindings where their behavior lives; this component owns the one window listener and the policy deciding when any of them may fire.
-->
<script lang="ts">
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useKeybindings } from '$lib/keybindings'

	const environment = useEnvironment()
	const keybindings = useKeybindings()

	const isEditable = (target: EventTarget | null) =>
		target instanceof HTMLElement &&
		(target.isContentEditable || target.closest('input, textarea, select') !== null)

	const onkeydown = (event: KeyboardEvent) => {
		if (!environment.current.inputBindingsEnabled) return
		// Modified presses belong to the browser (cmd+c) or to handlers with their
		// own modifier semantics; repeats would re-fire toggles while a key is held.
		if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
		if (isEditable(event.target)) return

		const handlers = keybindings.handlersFor(event.key, event.shiftKey)

		for (const handler of handlers) {
			if (handler.when?.() ?? true) {
				handler.run()
			}
		}
	}
</script>

<svelte:window {onkeydown} />
