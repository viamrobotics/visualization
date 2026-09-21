type JsonObject = Record<string, unknown>

/** A fragment's stored config, as the app API returns it. */
export type FragmentConfig = JsonObject

/** One entry of a config's `fragments` array. */
export interface FragmentImport {
	id: string
	variables?: Record<string, unknown>
	prefix?: string
	disabled?: boolean
}

export interface ResolvedFragmentImport {
	config: FragmentConfig
	/** Variables a placeholder asked for that nothing supplied, sorted and deduplicated. */
	missingVariables: string[]
	/**
	 * Per component name, the paths a variable supplied, relative to the
	 * component, mapped to the variable's name. Mirrors the `paths` map of the
	 * app's `ResourceVariablePaths`.
	 */
	variablePathsByComponent: Record<string, Record<string, string>>
}

/**
 * Resource sections whose entries carry a `name` a prefix rewrites. Mirrors
 * `ConfigNamedResourceKeys()` in the app's `data/models.go`.
 */
const NAMED_RESOURCE_KEYS = ['components', 'services', 'jobs', 'remotes', 'triggers'] as const

const isJsonObject = (value: unknown): value is JsonObject =>
	value !== null && typeof value === 'object' && !Array.isArray(value)

const compoundPrefix = (
	parent: string | undefined,
	child: string | undefined
): string | undefined => {
	if (parent === undefined) {
		return child
	}

	return child === undefined ? parent : `${parent}-${child}`
}

interface VariablePath {
	path: string
	variableName: string
}

interface Substitution {
	value: unknown
	missingVariables: string[]
	variablePaths: VariablePath[]
}

/**
 * Replaces `{"$variable": {...}}` and `{"$this": "name"}` throughout a config.
 *
 * A supplied variable wins, then the placeholder's own `default_value`. With
 * neither, the placeholder is left in place and its name recorded, matching the
 * server so a caller can decide what an unresolved fragment means.
 */
const substitute = (
	config: unknown,
	variables: Record<string, unknown>,
	prefix: string | undefined,
	path: string[] = []
): Substitution => {
	if (Array.isArray(config)) {
		const missingVariables: string[] = []
		const variablePaths: VariablePath[] = []
		const value = config.map((entry, index) => {
			const substituted = substitute(entry, variables, prefix, [...path, String(index)])
			missingVariables.push(...substituted.missingVariables)
			variablePaths.push(...substituted.variablePaths)
			return substituted.value
		})

		return { value, missingVariables, variablePaths }
	}

	if (!isJsonObject(config)) {
		return { value: config, missingVariables: [], variablePaths: [] }
	}

	const variableRef = config['$variable']
	if (isJsonObject(variableRef)) {
		const name = variableRef['name']
		if (typeof name !== 'string') {
			return { value: config, missingVariables: [], variablePaths: [] }
		}

		const found: VariablePath[] = [{ path: path.join('.'), variableName: name }]

		if (name in variables) {
			return { value: variables[name], missingVariables: [], variablePaths: found }
		}

		if ('default_value' in variableRef) {
			return { value: variableRef['default_value'], missingVariables: [], variablePaths: found }
		}

		return { value: config, missingVariables: [name], variablePaths: [] }
	}

	const thisRef = config['$this']
	if (typeof thisRef === 'string' && thisRef !== '') {
		return {
			value: prefix === undefined ? thisRef : `${prefix}-${thisRef}`,
			missingVariables: [],
			variablePaths: [],
		}
	}

	const value: JsonObject = {}
	const missingVariables: string[] = []
	const variablePaths: VariablePath[] = []
	for (const [key, entry] of Object.entries(config)) {
		const substituted = substitute(entry, variables, prefix, [...path, key])
		value[key] = substituted.value
		missingVariables.push(...substituted.missingVariables)
		variablePaths.push(...substituted.variablePaths)
	}

	return { value, missingVariables, variablePaths }
}

/**
 * Regroups flat `components.<index>.<rest>` paths under the component each index
 * names, dropping the rest. Ported from `groupVariablePathsByResource`, and run
 * per fragment before merging, since merging concatenates the arrays the indices
 * point into.
 */
const groupVariablePaths = (
	variablePaths: VariablePath[],
	config: FragmentConfig
): Record<string, Record<string, string>> => {
	const components = config['components']
	const grouped: Record<string, Record<string, string>> = {}

	if (!Array.isArray(components)) {
		return grouped
	}

	for (const { path, variableName } of variablePaths) {
		const match = /^components\.(\d+)\.(.+)$/.exec(path)
		if (!match) {
			continue
		}

		const component = components[Number(match[1])]
		if (!isJsonObject(component) || typeof component['name'] !== 'string') {
			continue
		}

		grouped[component['name']] ??= {}
		grouped[component['name']][match[2]] = variableName
	}

	return grouped
}

/** Rewrites every named resource's `name` to `<prefix>-<name>`. */
const applyPrefix = (config: FragmentConfig, prefix: string | undefined): FragmentConfig => {
	if (prefix === undefined) {
		return config
	}

	for (const key of NAMED_RESOURCE_KEYS) {
		const resources = config[key]
		if (!Array.isArray(resources)) {
			continue
		}

		for (const resource of resources) {
			if (isJsonObject(resource) && typeof resource['name'] === 'string') {
				resource['name'] = `${prefix}-${resource['name']}`
			}
		}
	}

	return config
}

/**
 * Merges `b` over `a`. Nested objects merge recursively, **arrays concatenate**,
 * and anything else takes `b`.
 *
 * Concatenation is why a nested fragment's components sit alongside the parent's
 * rather than being overridden by same-named ones. Ported from `mergeFragmentMaps`
 * in the app's `data/fragments.go`.
 */
const mergeFragmentConfigs = (a: FragmentConfig, b: FragmentConfig): FragmentConfig => {
	const out: FragmentConfig = { ...a }

	for (const [key, value] of Object.entries(b)) {
		const existing = out[key]

		if (isJsonObject(value) && isJsonObject(existing)) {
			out[key] = mergeFragmentConfigs(existing, value)
			continue
		}

		if (Array.isArray(value) && Array.isArray(existing)) {
			out[key] = [...existing, ...value]
			continue
		}

		out[key] = value
	}

	return out
}

const importsOf = (config: FragmentConfig): FragmentImport[] => {
	const fragments = config['fragments']
	if (!Array.isArray(fragments)) {
		return []
	}

	return fragments.flatMap((entry) => {
		if (typeof entry === 'string') {
			return [{ id: entry }]
		}

		if (isJsonObject(entry) && typeof entry['id'] === 'string') {
			return [
				{
					id: entry['id'],
					variables: isJsonObject(entry['variables']) ? entry['variables'] : undefined,
					prefix: typeof entry['prefix'] === 'string' ? entry['prefix'] : undefined,
					disabled: entry['disabled'] === true,
				},
			]
		}

		return []
	})
}

/**
 * Resolves one fragment import into the config the machine sees: variables
 * substituted, `$this` references and resource names prefixed, and every nested
 * fragment inlined beneath it.
 *
 * A port of `MergeNestedFragments` in the app's
 * `data/fragment_variable_substitution.go`. The order it runs in is load
 * bearing. Substitution happens before prefixing so a `$this` reference lands on
 * the prefixed name, and a child is merged before its parent so the parent's own
 * entries come last.
 *
 * The server performs this during `ResolveFragments`, but no API the TypeScript
 * SDK exposes returns the result, so it is done here instead.
 */
export const resolveFragmentImport = (
	fragmentImport: FragmentImport,
	configsById: Map<string, FragmentConfig>,
	variables: Record<string, unknown> = fragmentImport.variables ?? {},
	ancestors: ReadonlySet<string> = new Set()
): ResolvedFragmentImport => {
	if (ancestors.has(fragmentImport.id)) {
		return { config: {}, missingVariables: [], variablePathsByComponent: {} }
	}

	const stored = configsById.get(fragmentImport.id)
	if (stored === undefined) {
		return { config: {}, missingVariables: [], variablePathsByComponent: {} }
	}

	const substituted = substitute(stored, variables, fragmentImport.prefix)
	const missingVariables = [...substituted.missingVariables]
	const config = applyPrefix(
		isJsonObject(substituted.value) ? structuredClone(substituted.value) : {},
		fragmentImport.prefix
	)

	const variablePathsByComponent = groupVariablePaths(substituted.variablePaths, config)

	const nextAncestors = new Set(ancestors).add(fragmentImport.id)
	let mergedChildren: FragmentConfig = {}

	for (const childImport of importsOf(config)) {
		if (childImport.disabled) {
			continue
		}

		const resolvedChild = resolveFragmentImport(
			{ ...childImport, prefix: compoundPrefix(fragmentImport.prefix, childImport.prefix) },
			configsById,
			{ ...variables, ...childImport.variables },
			nextAncestors
		)

		missingVariables.push(...resolvedChild.missingVariables)
		mergedChildren = mergeFragmentConfigs(mergedChildren, resolvedChild.config)

		for (const [name, paths] of Object.entries(resolvedChild.variablePathsByComponent)) {
			for (const [path, variableName] of Object.entries(paths)) {
				// This fragment bound the variable on the child import, so the machine
				// cannot set it and it is not exposed as one the machine supplies.
				if (childImport.variables && variableName in childImport.variables) {
					continue
				}

				variablePathsByComponent[name] ??= {}
				variablePathsByComponent[name][path] ??= variableName
			}
		}
	}

	return {
		config: mergeFragmentConfigs(mergedChildren, config),
		missingVariables: [...new Set(missingVariables)].toSorted(),
		variablePathsByComponent,
	}
}
