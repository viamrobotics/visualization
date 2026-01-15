import { BufferGeometry, BufferAttribute, InstancedBufferGeometry } from 'three'

export const createShaftGeometry = () => {
	// Triangular prism aligned to +Y, base at y=0, top at y=1.
	// No caps, 6 verts, 6 side triangles.
	const positions = new Float32Array([
		// bottom (y=0)
		1, 0, 0,

		-0.5, 0, 0.8660254,

		-0.5, 0, -0.8660254,
		// top (y=1)
		1, 1, 0,

		-0.5, 1, 0.8660254,

		-0.5, 1, -0.8660254,
	])

	const indices = new Uint16Array([
		0, 3, 4, 0, 4, 1,

		1, 4, 5, 1, 5, 2,

		2, 5, 3, 2, 3, 0,
	])

	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new BufferAttribute(positions, 3))
	geometry.setIndex(new BufferAttribute(indices, 1))
	geometry.computeBoundingSphere()
	return geometry
}

export const createHeadGeometry = () => {
	// Triangular pyramid aligned to +Y, base at y=0, tip at y=1.
	// 4 verts, 3 side triangles.
	const positions = new Float32Array([
		// base (y=0)
		1, 0, 0,

		-0.5, 0, 0.8660254,

		-0.5, 0, -0.8660254,

		// tip (y=1)
		0, 1, 0,
	])

	const indices = new Uint16Array([
		0, 1, 3,

		1, 2, 3,

		2, 0, 3,

		0, 2, 1,
	])

	const geometry = new BufferGeometry()
	geometry.setAttribute('position', new BufferAttribute(positions, 3))
	geometry.setIndex(new BufferAttribute(indices, 1))
	geometry.computeBoundingSphere()
	return geometry
}

export const toInstanced = (
	baseGeometry: BufferGeometry,
	instanceCount: number,
	attributes: BufferGeometry['attributes']
) => {
	const geometry = new InstancedBufferGeometry()
	geometry.index = baseGeometry.index
	geometry.attributes.position = baseGeometry.attributes.position

	for (const [name, attribute] of Object.entries(attributes)) {
		geometry.setAttribute(name, attribute)
	}

	geometry.instanceCount = instanceCount
	return geometry
}
