import { invoke, isTauri } from '@tauri-apps/api/core'

/**
 * Tauri command that shows a native save dialog and writes the raw IPC body to the chosen path.
 * The Rust side registers it under the same name. The file name travels in the
 * {@link SAVE_FILE_NAME_HEADER} header so the body stays raw bytes.
 */
export const SAVE_FILE_COMMAND = 'save_file'

/** Header carrying the suggested file name for {@link SAVE_FILE_COMMAND}. */
export const SAVE_FILE_NAME_HEADER = 'x-file-name'

const NON_ASCII = /[^ -~]/g

const downloadInBrowser = (bytes: Uint8Array, fileName: string): void => {
	const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }))
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = fileName
	anchor.click()
	URL.revokeObjectURL(url)
}

/**
 * Saves `bytes` as a file. In Tauri the user picks the path in a native save dialog. In a browser
 * it is a download.
 *
 * @returns The saved path in Tauri, `fileName` for a browser download, or `undefined` when the user
 *   cancels the dialog.
 */
export const saveFile = async (
	bytes: Uint8Array,
	fileName: string
): Promise<string | undefined> => {
	if (!isTauri()) {
		downloadInBrowser(bytes, fileName)
		return fileName
	}

	// Header values are ASCII only.
	const headerName = fileName.replaceAll(NON_ASCII, '_')
	const path = await invoke<string | null>(SAVE_FILE_COMMAND, bytes, {
		headers: { [SAVE_FILE_NAME_HEADER]: headerName },
	})
	return path ?? undefined
}
