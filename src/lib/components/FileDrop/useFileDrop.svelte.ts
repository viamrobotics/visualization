export type DropStates = 'inactive' | 'hovering' | 'loading'

export const useFileDrop = () => {
	let dropState = $state<DropStates>('inactive')

	// prevent default to allow drop
	const ondragenter = (event: DragEvent) => {
		event.preventDefault()
		dropState = 'hovering'
	}

	// prevent default to allow drop
	const ondragover = (event: DragEvent) => {
		event.preventDefault()
	}

	const ondragleave = (event: DragEvent) => {
		// only deactivate if really leaving the window
		if (event.relatedTarget === null) {
			dropState = 'inactive'
		}
	}

	return {
		get dropState() {
			return dropState
		},

		set dropState(state: DropStates) {
			dropState = state
		},

		ondragenter,
		ondragover,
		ondragleave,
	}
}
