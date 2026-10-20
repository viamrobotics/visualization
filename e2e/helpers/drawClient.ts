import { type Client, createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { expect, type Page } from '@playwright/test'

import { DrawService } from '../../src/lib/buf/draw/v1/service_connect'

export type DrawClient = Client<typeof DrawService>

const DEFAULT_DRAW_PORT = 3030

/**
 * Talks to the same Connect service the browser subscribes to, so a test can
 * drive the scene without spawning a `go test` process per command.
 */
export const createDrawClient = (port: number = DEFAULT_DRAW_PORT): DrawClient =>
	createClient(DrawService, createConnectTransport({ baseUrl: `http://localhost:${port}` }))

/**
 * Clears the scene and waits for the browser to catch up. Entity teardown
 * reaches the page over `StreamEntityChanges`, so the RPC returning is not
 * enough — the empty-scene message is the observable end state.
 */
export const resetScene = async (client: DrawClient, page: Page): Promise<void> => {
	await client.removeAll({})
	await expect(page.getByText('No objects displayed', { exact: true })).toBeVisible({
		timeout: 15_000,
	})
}
