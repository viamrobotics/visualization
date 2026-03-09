import { fileURLToPath } from 'node:url'
import path from 'node:path'
import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import { includeIgnoreFile } from '@eslint/compat'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import ts from 'typescript-eslint'
import svelteConfig from './svelte.config.js'
import unicorn from 'eslint-plugin-unicorn'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const gitignorePath = path.resolve(__dirname, '.gitignore')

export default defineConfig(
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
		name: 'ignores',
		ignores: ['draw/DOCS.md', 'draw/__snapshots__'],
	},

	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		// See more details at: https://typescript-eslint.io/packages/parser/
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'], // Add support for additional file extensions, such as .svelte
				parser: ts.parser,
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
		name: 'viam/unicorn',
		rules: {
			'unicorn/custom-error-definition': 'error',
			'unicorn/no-null': 'off',
			'unicorn/no-unused-properties': 'error',
			'unicorn/no-useless-undefined': 'off',
			'unicorn/prefer-string-replace-all': 'error',
			'unicorn/prefer-top-level-await': 'off',
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/filename-case': 'off',
			'unicorn/prefer-switch': 'off',
			'unicorn/require-module-specifiers': 'off',
			'unicorn/numeric-separators-style': 'off',
			'unicorn/consistent-function-scoping': 'off',
			'unicorn/prefer-add-event-listener': 'off',
			'unicorn/number-literal-case': 'off',
			'unicorn/prefer-code-point': 'off',
			'unicorn/no-for-loop': 'off',
			'unicorn/prefer-blob-reading-methods': 'off',
			'unicorn/no-object-as-default-parameter': 'off',
			'unicorn/escape-case': 'off',
			'unicorn/no-process-exit': 'off',
			'unicorn/no-hex-escape': 'off',

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
