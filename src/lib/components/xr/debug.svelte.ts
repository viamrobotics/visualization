class DebugStore {
	messages = $state<string[]>(['debug panel ready'])

	add(message: string) {
		this.messages.push(message)
		if (this.messages.length > 8) {
			this.messages = this.messages.slice(-8)
		}
	}

	clear() {
		this.messages = []
	}
}

export const xrDebug = new DebugStore()
