import type { Attachment } from 'svelte/attachments'

export const domPortal = (target?: HTMLElement): Attachment => {
	return (element) => {
		const finalTarget = target ?? document.body
		finalTarget.append(element)

		return () => {
			element.remove()
		}
	}
}
