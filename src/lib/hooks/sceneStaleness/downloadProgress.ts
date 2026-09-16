const BYTES_PER_MEGABYTE = 1_000_000

/**
 * Download progress in megabytes, or undefined when the size is unknown.
 *
 * rdk sends a zero total for a package whose size it has not learned yet, and
 * `14.2 / 0.0 MB` reads as a failure rather than as a missing number.
 */
export const downloadProgress = (
	bytesDownloaded: number,
	totalBytes: number
): string | undefined => {
	if (totalBytes <= 0) {
		return undefined
	}

	const downloaded = (bytesDownloaded / BYTES_PER_MEGABYTE).toFixed(1)
	const total = (totalBytes / BYTES_PER_MEGABYTE).toFixed(1)

	return `${downloaded} / ${total} MB`
}
