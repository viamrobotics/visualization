import type { Page } from '@playwright/test'

import fs from 'node:fs'

/** Either a path to read from disk, or literal content to synthesize. */
export type DroppedFile = string | { name: string; content: string }

/**
 * Drops a file on the app's drop zone.
 *
 * The bytes cross into the page as base64 because a `File` cannot survive the
 * CDP boundary, and the drop is dispatched at the zone rather than simulated
 * with the mouse: Playwright cannot produce a real OS drag, so the events are
 * the only way in.
 */
export const dropFileOnPage = async (page: Page, dropped: DroppedFile): Promise<void> => {
	const isPath = typeof dropped === 'string'
	const base64Data = isPath
		? fs.readFileSync(dropped).toString('base64')
		: Buffer.from(dropped.content).toString('base64')
	const fileName = isPath ? (dropped.split('/').pop() ?? dropped) : dropped.name

	await page.evaluate(
		({ base64Data, fileName }) => {
			const binaryString = atob(base64Data)
			const bytes = new Uint8Array(binaryString.length)
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i)
			}

			const file = new File([bytes], fileName, { type: 'application/octet-stream' })
			const dataTransfer = new DataTransfer()
			dataTransfer.items.add(file)

			globalThis.dispatchEvent(
				new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer })
			)

			const dropZone = document.querySelector('[aria-label="File drop zone"]')
			if (!dropZone) {
				throw new Error('Drop zone not found')
			}

			dropZone.dispatchEvent(
				new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })
			)
		},
		{ base64Data, fileName }
	)
}
