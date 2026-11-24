/** A name's copy suffix, `-copy` or `-copy-N`, so a copy of a copy shares its source's base. */
const COPY_SUFFIX = /-copy(?:-\d+)?$/

/**
 * The name a copy of `sourceName` takes: `<base>-copy`, else the first `<base>-copy-N` from 2 up
 * that `takenNames` leaves free. Copying `table-copy` gives `table-copy-2`, not `table-copy-copy`.
 */
export const nextCopyName = (takenNames: Iterable<string>, sourceName: string): string => {
	const taken = new Set(takenNames)
	const copyName = `${sourceName.replace(COPY_SUFFIX, '')}-copy`
	if (!taken.has(copyName)) return copyName

	let index = 2
	while (taken.has(`${copyName}-${index}`)) index += 1

	return `${copyName}-${index}`
}
