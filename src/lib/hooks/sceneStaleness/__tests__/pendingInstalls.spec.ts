import { robotApi } from '@viamrobotics/sdk'
import { describe, expect, it } from 'vitest'

import { pendingInstalls } from '../pendingInstalls'

const module = (moduleName: string, state: robotApi.ModuleStatus_State): robotApi.ModuleStatus =>
	({
		moduleName,
		state,
		error: '',
		consecutiveFailures: 0,
	}) as robotApi.ModuleStatus

/** `PACKAGE_TYPE_MODULE`, the only type the badge counts. */
const MODULE = 3

/** `PACKAGE_TYPE_ML_MODEL`, standing for any type that is not a module. */
const ML_MODEL = 2

const packageStatus = (
	name: string,
	state: robotApi.PackageStatus_State,
	bytesDownloaded = 0n,
	totalBytes = 0n,
	type = MODULE
): robotApi.PackageStatus =>
	({
		name,
		type,
		state,
		error: '',
		version: '1.0.0',
		bytesDownloaded,
		totalBytes,
	}) as robotApi.PackageStatus

describe('pendingInstalls', () => {
	it('reports nothing for a machine with nothing installing', () => {
		expect(pendingInstalls()).toEqual([])
		expect(pendingInstalls([], [])).toEqual([])
	})

	it.each([
		['pending', robotApi.ModuleStatus_State.PENDING],
		['starting', robotApi.ModuleStatus_State.STARTING],
		['closing', robotApi.ModuleStatus_State.CLOSING],
	])('reports a %s module', (label, state) => {
		expect(pendingInstalls([module('viam:realsense', state)])).toEqual([
			{ name: 'viam:realsense', state: label, bytesDownloaded: 0, totalBytes: 0 },
		])
	})

	it.each([
		['ready', robotApi.ModuleStatus_State.READY],
		['unhealthy', robotApi.ModuleStatus_State.UNHEALTHY],
		['unspecified', robotApi.ModuleStatus_State.UNSPECIFIED],
	])('ignores a %s module', (_label, state) => {
		expect(pendingInstalls([module('viam:realsense', state)])).toEqual([])
	})

	it.each([
		['downloading', robotApi.PackageStatus_State.DOWNLOADING],
		['loading', robotApi.PackageStatus_State.LOADING],
		['first run', robotApi.PackageStatus_State.FIRST_RUN],
	])('reports a %s package', (label, state) => {
		expect(pendingInstalls([], [packageStatus('viam:realsense', state)])).toEqual([
			{ name: 'viam:realsense', state: label, bytesDownloaded: 0, totalBytes: 0 },
		])
	})

	it.each([
		['ready', robotApi.PackageStatus_State.READY],
		['failed', robotApi.PackageStatus_State.FAILED],
		['unspecified', robotApi.PackageStatus_State.UNSPECIFIED],
	])('ignores a %s package', (_label, state) => {
		expect(pendingInstalls([], [packageStatus('viam:realsense', state)])).toEqual([])
	})

	it('narrows the bigint byte counts the proto carries to numbers', () => {
		const packages = [
			packageStatus(
				'viam:realsense',
				robotApi.PackageStatus_State.DOWNLOADING,
				14_200_000n,
				61_000_000n
			),
		]

		expect(pendingInstalls([], packages)).toEqual([
			{
				name: 'viam:realsense',
				state: 'downloading',
				bytesDownloaded: 14_200_000,
				totalBytes: 61_000_000,
			},
		])
	})

	it('folds a module and its package into one entry, keeping the half with progress', () => {
		const modules = [module('viam:realsense', robotApi.ModuleStatus_State.PENDING)]
		const packages = [
			packageStatus(
				'viam:realsense',
				robotApi.PackageStatus_State.DOWNLOADING,
				14_200_000n,
				61_000_000n
			),
		]

		expect(pendingInstalls(modules, packages)).toEqual([
			{
				name: 'viam:realsense',
				state: 'downloading',
				bytesDownloaded: 14_200_000,
				totalBytes: 61_000_000,
			},
		])
	})

	it('reports a module and its package separately when the two names differ', () => {
		const modules = [module('viam:realsense', robotApi.ModuleStatus_State.PENDING)]
		const packages = [packageStatus('realsense-tarball', robotApi.PackageStatus_State.DOWNLOADING)]

		expect(pendingInstalls(modules, packages).map(({ name }) => name)).toEqual([
			'viam:realsense',
			'realsense-tarball',
		])
	})

	it.each([
		['ml model', ML_MODEL],
		['unspecified', 0],
	])('ignores a %s package, which installs no models a resource is built from', (_label, type) => {
		const packages = [
			packageStatus('my-model', robotApi.PackageStatus_State.DOWNLOADING, 0n, 0n, type),
		]

		expect(pendingInstalls([], packages)).toEqual([])
	})

	it('never lets a non-module package displace a module of the same name', () => {
		const modules = [module('shared-name', robotApi.ModuleStatus_State.STARTING)]
		const packages = [
			packageStatus('shared-name', robotApi.PackageStatus_State.LOADING, 0n, 0n, ML_MODEL),
		]

		expect(pendingInstalls(modules, packages)).toEqual([
			{ name: 'shared-name', state: 'starting', bytesDownloaded: 0, totalBytes: 0 },
		])
	})
})
