/**
 * A hand conversion of `spatialmath/geometry.go`, shared by the config and
 * motion plan readers so neither can disagree about an untyped geometry.
 */

/** The `GeometryConfig` fields a shape can be inferred from. */
export type RawGeometryJson = Record<string, unknown>

/**
 * RDK's `GeometryConfig.ParseConfig` treats an empty `type` as "infer from whichever dimensions were
 * set": box if `r3.Vector{X, Y, Z}.Norm() > 0`, else capsule if `L != 0`, else sphere. The three
 * predicates below are that chain, in that order.
 *
 * What this does *not* reproduce is the validation each arm then runs. RDK constructs the shape it
 * picked and yields no geometry at all when the constructor refuses the dimensions — a negative box
 * side, a capsule with `r <= 0` or `l < 2r` — and `NewCapsule` returns a *sphere* outright when
 * `l == 2r`. Every one of those needs a config RDK rejected while configuring the part, so a machine
 * able to answer at all has already been through those gates. The divergence is written down rather
 * than guarded, because a guard against input that cannot arrive is a guard nothing can test.
 *
 * Returns the declared type untouched when there is one, so a caller can run every geometry through
 * this and switch on one value.
 */
export const inferGeometryType = (g: RawGeometryJson): string => {
	const declared = (g.type ?? '') as string
	if (declared !== '') return declared

	const x = (g.x as number) ?? 0
	const y = (g.y as number) ?? 0
	const z = (g.z as number) ?? 0
	if (Math.hypot(x, y, z) > 0) return 'box'

	// `l` before `r`: a capsule sets both, and RDK checks the length first for the same reason.
	// `r` checks `> 0` rather than `!== 0`: a negative radius describes no real sphere, and this
	// keeps that struct falling through to `''` — "no geometry" — instead of building one.
	if (((g.l as number) ?? 0) !== 0) return 'capsule'
	if (((g.r as number) ?? 0) > 0) return 'sphere'

	return ''
}
