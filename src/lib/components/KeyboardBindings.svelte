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
		// Repeats would re-fire a toggle while the key is held. Option is never part of a
		// shortcut, because macOS rewrites the character it reports.
		if (event.repeat || event.altKey) return

		const mod = event.metaKey || event.ctrlKey

		// An unmodified press typed into a field belongs to the field. A modified one does
		// not, so ⌘S still saves while an input has focus.
		if (!mod && isEditable(event.target)) return

		const matched = keybindings.matching({ key: event.key, shift: event.shiftKey, mod })

		for (const { binding, handler } of matched) {
			if (!(handler.when?.() ?? true)) continue

			if (binding.preventDefault) {
				event.preventDefault()
			}

			handler.run()
		}
	}
</script>

<svelte:window onkeydowncapture={onkeydown} />
