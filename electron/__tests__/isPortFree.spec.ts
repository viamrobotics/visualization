import { createServer, type Server } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'

import { isPortFree } from '../isPortFree'

let holder: Server | undefined

/** Listens on a free port on all interfaces and returns it. */
const holdAnyPort = () =>
	new Promise<number>((resolve) => {
		holder = createServer()
		holder.listen(0, () => {
			const address = holder?.address()
			if (address && typeof address === 'object') resolve(address.port)
		})
	})

afterEach(() => {
	holder?.close()
	holder = undefined
})

describe('isPortFree', () => {
	it('reports a port another process listens on as taken', async () => {
		const port = await holdAnyPort()
		await expect(isPortFree(port)).resolves.toBe(false)
	})

	it('reports a released port as free, and releases its own probe', async () => {
		const port = await holdAnyPort()
		await new Promise((resolve) => holder?.close(resolve))
		holder = undefined

		await expect(isPortFree(port)).resolves.toBe(true)
		await expect(isPortFree(port)).resolves.toBe(true)
	})
})
