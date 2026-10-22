// The contract line cmd/draw-server prints on stdout once it binds. See listeningPrefix in its main.go.
const PORT_LINE_PREFIX = 'draw-server: listening on http://127.0.0.1:'

/**
 * The port in a draw-server stdout line, or `undefined` for any other line. Port 0 is rejected,
 * since it would mean the server never bound a real socket.
 */
export const parsePortLine = (line: string): number | undefined => {
	const trimmed = line.replace(/[\r\n]+$/, '')
	if (!trimmed.startsWith(PORT_LINE_PREFIX)) return undefined

	const digits = trimmed.slice(PORT_LINE_PREFIX.length)
	if (!/^\d+$/.test(digits)) return undefined

	const port = Number(digits)
	return port > 0 && port <= 65_535 ? port : undefined
}
