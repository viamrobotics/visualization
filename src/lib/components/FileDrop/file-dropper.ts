import type { Snapshot } from '$lib/draw/v1/snapshot_pb'
import type { SuccessMessage } from '$lib/loaders/pcd/worker'
import type { BufferGeometry } from 'three'

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
