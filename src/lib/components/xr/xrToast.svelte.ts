export type ToastVariant = 'success' | 'danger' | 'warning' | 'info'

export interface XRToastItem {
	id: number
	message: string
	variant: ToastVariant
	createdAt: number
	duration: number
}

class VRToastStore {
	toasts = $state<XRToastItem[]>([])
	private nextId = 0

	add(message: string, variant: ToastVariant = 'info', duration = 3000): number {
		const id = this.nextId++
		this.toasts.push({
			id,
			message,
			variant,
			createdAt: Date.now(),
			duration,
		})
		setTimeout(() => this.remove(id), duration)
		return id
	}

	remove(id: number) {
		this.toasts = this.toasts.filter((t) => t.id !== id)
	}

	success(message: string, duration?: number) {
		return this.add(message, 'success', duration)
	}

	danger(message: string, duration?: number) {
		return this.add(message, 'danger', duration)
	}

	warning(message: string, duration?: number) {
		return this.add(message, 'warning', duration)
	}

	info(message: string, duration?: number) {
		return this.add(message, 'info', duration)
	}
}

export const xrToast = new VRToastStore()
