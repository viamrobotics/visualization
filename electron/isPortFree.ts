import { createServer } from 'node:net'

/**
 * Whether nothing is listening on `port`. Binds on all interfaces, as draw-server's `:<port>` does,
 * so a listener on any interface counts as taken.
 */
export const isPortFree = (port: number): Promise<boolean> =>
	new Promise((resolve) => {
		const probe = createServer()
		probe.once('error', () => resolve(false))
		probe.listen(port, () => {
			probe.close(() => resolve(true))
		})
	})
