const UNSAFE_FILE_CHARACTERS = /[^\w-]/g

/**
 * Hands out unique STL file names under `meshes/`, readable from the body they belong to. Body names
 * carry `:` and other characters a file system or URI may reject, so those become `_`.
 */
export const meshFileNamer = () => {
	const taken = new Set<string>()
	return (bodyName: string): string => {
		const stem = bodyName.replaceAll(UNSAFE_FILE_CHARACTERS, '_')
		let name = `${stem}.stl`
		for (let suffix = 2; taken.has(name); suffix++) name = `${stem}_${suffix}.stl`
		taken.add(name)
		return `meshes/${name}`
	}
}
