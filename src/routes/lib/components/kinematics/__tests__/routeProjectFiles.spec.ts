import { describe, expect, it } from 'vitest'

import { KinematicsSpec, Link } from '$lib/buf/kinematics/v1/spec_pb'

import { routeProjectFiles } from '../routeProjectFiles'

const file = (name: string, text = '') => ({ name, bytes: new TextEncoder().encode(text) })

const specFile = (name = 'kinematics.json') =>
	file(
		name,
		new KinematicsSpec({ links: [new Link({ id: 'base', meshPath: 'base.stl' })] }).toJsonString()
	)

describe('routeProjectFiles', () => {
	it('imports the first zip even beside a spec and meshes', () => {
		const zip = file('a.zip')
		const route = routeProjectFiles([specFile(), file('base.stl'), zip, file('b.zip')])
		expect(route).toEqual({ kind: 'zip', file: zip })
	})

	it('loads a project when a kinematics.json is present, over meshes', () => {
		const route = routeProjectFiles([file('base.stl', 'mesh'), specFile()])
		expect(route.kind).toBe('project')
		if (route.kind !== 'project') return
		expect(route.project.sources.map((source) => source.name)).toEqual(['base.stl'])
		expect(route.project.missing).toEqual([])
	})

	it('names a folder drop by path and finds the spec inside it', () => {
		const route = routeProjectFiles([file('arm/cad/base.stl'), specFile('arm/kinematics.json')])
		expect(route.kind).toBe('project')
		if (route.kind !== 'project') return
		expect(route.project.sources.map((source) => source.name)).toEqual(['base.stl'])
	})

	it('reports sources the folder lacks as missing', () => {
		const route = routeProjectFiles([specFile()])
		expect(route.kind === 'project' && route.project.missing).toEqual(['base.stl'])
	})

	it('adds only the meshes when there is no spec or zip', () => {
		const base = file('base.STL')
		const arm = file('arm.ply')
		expect(routeProjectFiles([base, file('notes.txt'), arm])).toEqual({
			kind: 'meshes',
			files: [base, arm],
		})
	})

	it('classifies OBJ and DAE files as meshes', () => {
		const obj = file('part.OBJ')
		const dae = file('part.dae')
		expect(routeProjectFiles([obj, dae])).toEqual({ kind: 'meshes', files: [obj, dae] })
	})

	it('reports nothing supported otherwise', () => {
		expect(routeProjectFiles([file('notes.txt')])).toEqual({ kind: 'unsupported' })
		expect(routeProjectFiles([])).toEqual({ kind: 'unsupported' })
	})

	it('throws for a spec that does not parse', () => {
		expect(() => routeProjectFiles([file('kinematics.json', 'not json')])).toThrow(/not a valid/)
	})

	it('routes loose files with a urdf or xacro to the URDF import', () => {
		const urdf = file('arm/robot.URDF', '<robot/>')
		const route = routeProjectFiles([file('arm/base.stl'), urdf])
		expect(route).toEqual({ kind: 'urdf', files: [file('arm/base.stl'), urdf] })
		expect(routeProjectFiles([file('a.xacro')]).kind).toBe('urdf')
	})

	it('prefers a kinematics.json and a zip over a urdf', () => {
		expect(routeProjectFiles([specFile(), file('a.urdf'), file('base.stl')]).kind).toBe('project')
		expect(routeProjectFiles([file('a.zip'), file('a.urdf')]).kind).toBe('zip')
	})
})
