import type { ValueOf } from 'type-fest'

export const Extensions = {
	JSON: 'json',
	PCD: 'pcd',
	PLY: 'ply',
	PB: 'pb',
	PB_GZ: 'pb.gz',
} as const

export const Prefixes = {
	Snapshot: 'visualization_snapshot',
} as const

class FileNameError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'FileNameError'
	}
}

interface ParseFileSuccess {
	success: true
	extension: ValueOf<typeof Extensions>
	prefix: ValueOf<typeof Prefixes> | undefined
}

interface ParseFileError {
	success: false
	error: FileNameError
}

type ParseFileResult = ParseFileSuccess | ParseFileError

const isExtension = (extension: string): extension is ValueOf<typeof Extensions> => {
	return Object.values(Extensions).includes(extension as ValueOf<typeof Extensions>)
}

const hasPrefix = (name: string): ValueOf<typeof Prefixes> | undefined => {
	for (const prefix of Object.values(Prefixes)) {
		if (name.startsWith(prefix)) return prefix
	}

	return undefined
}

const validatePrefix = (
	extension: ValueOf<typeof Extensions>,
	prefix: string
): FileNameError | undefined => {
	switch (prefix) {
		case Prefixes.Snapshot:
			if (
				extension !== Extensions.JSON &&
				extension !== Extensions.PB &&
				extension !== Extensions.PB_GZ
			) {
				return new FileNameError(
					`Only ${Extensions.JSON}, ${Extensions.PB} and ${Extensions.PB_GZ} snapshot files are supported.`
				)
			}
			break
	}

	return undefined
}

export const parseFileName = (filename: string): ParseFileResult => {
	const [name, ...extensions] = filename.split('.')
	const suffix = extensions.at(-1)
	if (!suffix) {
		return {
			success: false,
			error: new FileNameError('Could not determine file extension.'),
		}
	}

	const nested = extensions.at(-2)
	let extension = suffix
	if (nested) {
		const nestedExtension = `${nested}.${suffix}`
		if (isExtension(nestedExtension)) {
			extension = nestedExtension
		}
	}

	if (!isExtension(extension)) {
		return {
			success: false,
			error: new FileNameError(`Only ${Object.values(Extensions).join(', ')} files are supported.`),
		}
	}

	const prefix = hasPrefix(name)
	if (prefix) {
		const error = validatePrefix(extension, prefix)
		if (error) {
			return {
				success: false,
				error,
			}
		}

		return { success: true, extension, prefix }
	}

	return { success: true, extension, prefix: undefined }
}

export const readFile = (
	file: File,
	reader: FileReader,
	extension: ValueOf<typeof Extensions> | undefined
) => {
	if (!extension) return
	switch (extension) {
		case Extensions.JSON:
			return reader.readAsText(file)
		case Extensions.PCD:
		case Extensions.PLY:
		case Extensions.PB:
		case Extensions.PB_GZ:
			return reader.readAsArrayBuffer(file)
	}
}
