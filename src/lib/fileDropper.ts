import type { BufferGeometry } from 'three'

import type { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import type { SuccessMessage } from '$lib/loaders/pcd/messages'

interface FileDropSuccess {
	success: true
	name: string
}

export interface SnapshotFileDropSuccess extends FileDropSuccess {
	type: 'snapshot'
	snapshot: Snapshot
}

export interface PointcloudFileDropSuccess extends FileDropSuccess {
	type: 'pcd'
	pcd: SuccessMessage
}

export interface PlyFileDropSuccess extends FileDropSuccess {
	type: 'ply'
	ply: BufferGeometry
}

export class FileDropperError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'FileDropperError'
	}
}

/**
 * Folds the cause into the message, because only the message reaches the toast. Loaders reject
 * with whatever they please — the pcd worker sends a bare string, three.js throws an `Error` —
 * so a dropped file that fails for a diagnosable reason otherwise reports nothing but "failed".
 */
export const parseFailure = (name: string, cause: unknown): FileDropperFailure => {
	const detail = cause instanceof Error ? cause.message : String(cause)

	return {
		success: false,
		error: new FileDropperError(`${name} failed to parse: ${detail}`, { cause }),
	}
}

export type FileDropperSuccess =
	| SnapshotFileDropSuccess
	| PointcloudFileDropSuccess
	| PlyFileDropSuccess

export interface FileDropperFailure {
	success: false
	error: FileDropperError
}

export type FileDropperResult = FileDropperSuccess | FileDropperFailure

export type FileDropperParams = {
	name: string
	extension: string
	prefix: string | undefined
	content: string | ArrayBuffer | null | undefined
}

export type FileDropper = (params: FileDropperParams) => Promise<FileDropperResult>
