import { get, set } from 'idb-keyval'

interface Context {
	onDragStart: (event: MouseEvent) => void
	onDragEnd: (event: MouseEvent) => void
	readonly current: {
		x: number
		y: number
	}
}

export const useDraggable = (name: string): Context => {
	const down = { x: 0, y: 0 }
	const last = { x: 0, y: 0 }

	let translate = $state({ x: 0, y: 0 })

	const onDragMove = (event: MouseEvent) => {
		translate.x = event.clientX - down.x + last.x
		translate.y = event.clientY - down.y + last.y
	}

	const onDragStart = (event: MouseEvent) => {
		down.x = event.clientX
		down.y = event.clientY
		last.x = translate.x
		last.y = translate.y

		window.addEventListener('pointermove', onDragMove, { passive: true })
	}

	const onDragEnd = () => {
		set(`${name}-draggable`, $state.snapshot(translate))
		window.removeEventListener('pointermove', onDragMove)
	}

	get(`${name}-draggable`).then((response) => {
		if (response) {
			translate = response
		}
	})

	$effect(() => {
		return () => window.removeEventListener('pointermove', onDragMove)
	})

	return {
		onDragStart,
		onDragEnd,
		get current() {
			return translate
		},
	}
}
