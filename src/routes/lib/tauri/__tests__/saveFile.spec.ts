import { invoke, isTauri } from '@tauri-apps/api/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { saveFile } from '../saveFile'

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
	isTauri: vi.fn(),
}))

const bytes = new Uint8Array([1, 2, 3])

describe('saveFile in Tauri', () => {
	beforeEach(() => {
		vi.mocked(isTauri).mockReturnValue(true)
		vi.mocked(invoke).mockResolvedValue('/tmp/scene.zip')
	})

	it('sends the bytes as the payload with the file name header and returns the path', async () => {
		const path = await saveFile(bytes, 'scene.zip')

		expect(path).toBe('/tmp/scene.zip')
		expect(invoke).toHaveBeenCalledWith('save_file', bytes, {
			headers: { 'x-file-name': 'scene.zip' },
		})
	})

	it('returns undefined when the user cancels the dialog', async () => {
		vi.mocked(invoke).mockResolvedValue(null)

		expect(await saveFile(bytes, 'scene.zip')).toBeUndefined()
	})

	it('replaces non-ASCII characters in the header name with underscores', async () => {
		await saveFile(bytes, 'café.zip')

		expect(invoke).toHaveBeenCalledWith('save_file', bytes, {
			headers: { 'x-file-name': 'caf_.zip' },
		})
	})
})

describe('saveFile in a browser', () => {
	let clickedDownloads: string[]
	let createObjectURL: ReturnType<typeof vi.spyOn>
	let revokeObjectURL: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		vi.mocked(isTauri).mockReturnValue(false)
		clickedDownloads = []
		createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url')
		revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
			this: HTMLAnchorElement
		) {
			clickedDownloads.push(`${this.download}|${this.href}`)
		})
	})

	afterEach(() => {
		createObjectURL.mockClear()
		revokeObjectURL.mockClear()
	})

	it('clicks an anchor whose download is the file name and returns the file name', async () => {
		const result = await saveFile(bytes, 'scene.zip')

		expect(result).toBe('scene.zip')
		expect(clickedDownloads).toEqual(['scene.zip|blob:test-url'])
		expect(invoke).not.toHaveBeenCalled()
	})

	it('creates one zip object URL and revokes it', async () => {
		await saveFile(bytes, 'scene.zip')

		expect(createObjectURL).toHaveBeenCalledOnce()
		expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe('application/zip')
		expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:test-url')
	})
})
