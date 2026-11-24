/** A color as 0–1 channels, in whatever color space the caller already holds them. */
export interface ColorChannels {
	r: number
	g: number
	b: number
}

const CHANNEL_MAX = 255
const HEX_RADIX = 16

const channelHex = (channel: number): string =>
	Math.round(Math.min(Math.max(channel, 0), 1) * CHANNEL_MAX)
		.toString(HEX_RADIX)
		.padStart(2, '0')

/**
 * The `#rrggbb` a color input shows for these channels. No color-space conversion happens, so a
 * round trip through `hexToColorChannels` changes a channel only by its 8-bit rounding.
 */
export const colorChannelsToHex = ({ r, g, b }: ColorChannels): string =>
	`#${channelHex(r)}${channelHex(g)}${channelHex(b)}`

/** The 0–1 channels of a `#rrggbb` string, the format a color input reports. */
export const hexToColorChannels = (hex: string): ColorChannels => {
	const value = Number.parseInt(hex.slice(1), HEX_RADIX)
	return {
		r: ((value >> 16) & CHANNEL_MAX) / CHANNEL_MAX,
		g: ((value >> 8) & CHANNEL_MAX) / CHANNEL_MAX,
		b: (value & CHANNEL_MAX) / CHANNEL_MAX,
	}
}
