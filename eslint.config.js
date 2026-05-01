import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import perfectionist from 'eslint-plugin-perfectionist'
import svelte from 'eslint-plugin-svelte'
import unicorn from 'eslint-plugin-unicorn'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript-eslint'

import svelteConfig from './svelte.config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const gitignorePath = path.resolve(__dirname, '.gitignore')

export default defineConfig(
	perfectionist.configs['recommended-natural'],
	js.configs.recommended,
	ts.configs.recommended,
	unicorn.configs.recommended,
	svelte.configs.recommended,
	svelte.configs.prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},

	includeIgnoreFile(gitignorePath),

	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		// See more details at: https://typescript-eslint.io/packages/parser/
		languageOptions: {
			parserOptions: {
				extraFileExtensions: ['.svelte'], // Add support for additional file extensions, such as .svelte
				parser: ts.parser,
				projectService: true,
				// Specify a parser for each language, if needed:
				// parser: {
				//   ts: ts.parser,
				//   js: espree,    // Use espree for .js files (add: import espree from 'espree')
				//   typescript: ts.parser
				// },

				// We recommend importing and specifying svelte.config.js.
				// By doing so, some rules in eslint-plugin-svelte will automatically read the configuration and adjust their behavior accordingly.
				// While certain Svelte settings may be statically loaded from svelte.config.js even if you don’t specify it,
				// explicitly specifying it ensures better compatibility and functionality.
				svelteConfig,
			},
		},
	},

	{
		name: 'viam/base',
		rules: {
			'no-useless-assignment': 'off',
		},
	},

	{
		name: 'viam/svelte/svelte-base',
		rules: {
			// Off because this currently has false positives
			'svelte/prefer-svelte-reactivity': 'off',
		},
	},

	{
		name: 'viam/perfectionist',
		rules: {
			'perfectionist/sort-array-includes': 'off',
			'perfectionist/sort-classes': 'off',
			'perfectionist/sort-decorators': 'off',
			'perfectionist/sort-enums': 'off',
			'perfectionist/sort-export-attributes': 'off',
			'perfectionist/sort-exports': 'off',
			'perfectionist/sort-heritage-clauses': 'off',
			'perfectionist/sort-interfaces': 'off',
			'perfectionist/sort-intersection-types': 'off',
			'perfectionist/sort-jsx-props': 'off',
			'perfectionist/sort-maps': 'off',
			'perfectionist/sort-modules': 'off',
			'perfectionist/sort-named-exports': 'off',
			'perfectionist/sort-object-types': 'off',
			'perfectionist/sort-objects': 'off',
			'perfectionist/sort-sets': 'off',
			'perfectionist/sort-switch-case': 'off',
			'perfectionist/sort-union-types': 'off',
			'perfectionist/sort-variable-declarations': 'off',

			'perfectionist/sort-imports': [
				'error',
				{
					internalPattern: [String.raw`^\$`],
				},
			],
		},
	},

	{
		name: 'viam/unicorn',
		rules: {
			'unicorn/consistent-function-scoping': 'off',
			'unicorn/custom-error-definition': 'error',
			'unicorn/escape-case': 'off',
			'unicorn/filename-case': 'off',
			'unicorn/no-for-loop': 'off',
			'unicorn/no-hex-escape': 'off',
			'unicorn/no-null': 'off',
			'unicorn/no-object-as-default-parameter': 'off',
			'unicorn/no-process-exit': 'off',
			'unicorn/no-unused-properties': 'error',
			'unicorn/no-useless-undefined': 'off',
			'unicorn/number-literal-case': 'off',
			'unicorn/numeric-separators-style': 'off',
			'unicorn/prefer-add-event-listener': 'off',
			'unicorn/prefer-blob-reading-methods': 'off',
			'unicorn/prefer-code-point': 'off',
			'unicorn/prefer-string-replace-all': 'error',
			'unicorn/prefer-switch': 'off',
			'unicorn/prefer-top-level-await': 'off',
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/require-module-specifiers': 'off',

			// TODO
			// 'unicorn/filename-case': [
			// 	'error',
			// 	{
			// 		cases: {
			// 			camelCase: true,
			// 			pascalCase: true,
			// 		},
			// 	},
			// ],
		},
	}
)
