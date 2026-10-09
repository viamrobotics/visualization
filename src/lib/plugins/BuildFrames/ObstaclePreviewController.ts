import type { ObstacleGeometryConfig } from '$lib/obstacleAttributes'

/** Pushes one obstacle's geometries to the machine, e.g. through `DoCommand {"command": "set"}`. */
export type SendObstacleGeometries = (
	componentName: string,
	geometries: ObstacleGeometryConfig[]
) => void

/** Deep equality for JSON values. Object key order is ignored, array order is not. */
const isSameJson = (left: unknown, right: unknown): boolean => {
	if (left === right) return true
	if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
		return false
	}

	if (Array.isArray(left) || Array.isArray(right)) {
		return (
			Array.isArray(left) &&
			Array.isArray(right) &&
			left.length === right.length &&
			left.every((item, index) => isSameJson(item, right[index]))
		)
	}

	const leftRecord = left as Record<string, unknown>
	const rightRecord = right as Record<string, unknown>
	const leftKeys = Object.keys(leftRecord)
	if (leftKeys.length !== Object.keys(rightRecord).length) return false

	return leftKeys.every(
		(key) => key in rightRecord && isSameJson(leftRecord[key], rightRecord[key])
	)
}

interface PendingSend {
	geometries: ObstacleGeometryConfig[]
	timer: ReturnType<typeof setTimeout>
}

/**
 * Mirrors draft obstacle geometries onto the machine's live frame system while they
 * are edited. It sends an obstacle's geometries once they differ from what the
 * machine last received, debounced, so a discard (which reverts the config)
 * sends the saved geometries back and a save sends nothing.
 */
export class ObstaclePreviewController {
	private readonly received = new Map<string, ObstacleGeometryConfig[]>()
	private readonly pending = new Map<string, PendingSend>()

	constructor(
		private readonly send: SendObstacleGeometries,
		private readonly delayMs: number
	) {}

	/**
	 * Feed the latest config geometries of every obstacle the machine knows. The
	 * first call after construction or `stop` takes a clean config as what the
	 * machine already has, and a dirty one as a draft to send.
	 */
	update(obstacles: Record<string, ObstacleGeometryConfig[]>, isDirty: boolean): void {
		for (const name of [...this.received.keys(), ...this.pending.keys()]) {
			if (!(name in obstacles)) this.forget(name)
		}

		for (const [name, geometries] of Object.entries(obstacles)) {
			const lastReceived = this.received.get(name)

			if (lastReceived === undefined && !isDirty) {
				this.received.set(name, geometries)
			} else if (lastReceived !== undefined && isSameJson(lastReceived, geometries)) {
				this.cancel(name)
			} else {
				this.schedule(name, geometries)
			}
		}
	}

	/** Cancels pending sends and forgets what was sent. */
	stop(): void {
		for (const { timer } of this.pending.values()) clearTimeout(timer)
		this.pending.clear()
		this.received.clear()
	}

	private schedule(name: string, geometries: ObstacleGeometryConfig[]): void {
		this.cancel(name)

		const timer = setTimeout(() => {
			this.pending.delete(name)
			this.received.set(name, geometries)
			this.send(name, geometries)
		}, this.delayMs)

		this.pending.set(name, { geometries, timer })
	}

	private cancel(name: string): void {
		const pending = this.pending.get(name)
		if (pending === undefined) return

		clearTimeout(pending.timer)
		this.pending.delete(name)
	}

	private forget(name: string): void {
		this.cancel(name)
		this.received.delete(name)
	}
}
