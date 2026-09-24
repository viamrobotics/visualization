import type { RefreshRateId } from '$lib/hooks/useSettings.svelte'

export const RefetchRates = {
	OFF: -1,
	MANUAL: 0,
	FPS_60: 17,
	FPS_30: 33,
	MS_500: 500,
	MS_1000: 1000,
	MS_2000: 2000,
	MS_5000: 5000,
	MS_10000: 10_000,
} as const

export interface RefetchRateOption {
	value: number
	label: string
	/** Sub-second rate, offered only to a group whose source can keep up with it. */
	isLive?: boolean
}

/** Display order for every control that picks a polling rate. */
const options: RefetchRateOption[] = [
	{ value: RefetchRates.OFF, label: 'Do not fetch' },
	{ value: RefetchRates.MANUAL, label: 'Manual' },
	{ value: RefetchRates.FPS_60, label: '60fps', isLive: true },
	{ value: RefetchRates.FPS_30, label: '30fps', isLive: true },
	{ value: RefetchRates.MS_500, label: 'Refresh every 0.5 second' },
	{ value: RefetchRates.MS_1000, label: 'Refresh every second' },
	{ value: RefetchRates.MS_2000, label: 'Refresh every 2 seconds' },
	{ value: RefetchRates.MS_5000, label: 'Refresh every 5 seconds' },
	{ value: RefetchRates.MS_10000, label: 'Refresh every 10 seconds' },
]

/** Groups cheap enough to poll below a second. A point cloud fetch is not. */
const LIVE_POLL_GROUPS = new Set<RefreshRateId>(['poses'])

export const refetchRateOptionsFor = (id: RefreshRateId): RefetchRateOption[] =>
	LIVE_POLL_GROUPS.has(id) ? options : options.filter((option) => !option.isLive)
