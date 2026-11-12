import { describe, expect, it } from 'vitest'

import { parsePortLine } from '../drawServerPort'

describe('parsePortLine', () => {
	it('reads the port from the contract line', () => {
		expect(parsePortLine('draw-server: listening on http://127.0.0.1:59696')).toBe(59_696)
	})

	it('tolerates a trailing CRLF', () => {
		expect(parsePortLine('draw-server: listening on http://127.0.0.1:59696\r\n')).toBe(59_696)
	})

	it('rejects port 0', () => {
		expect(parsePortLine('draw-server: listening on http://127.0.0.1:0')).toBeUndefined()
	})

	it('rejects a log line that mentions a port', () => {
		expect(
			parsePortLine('2026/10/19 10:27:44 draw server Connect-RPC on http://localhost:59696')
		).toBeUndefined()
	})
})
