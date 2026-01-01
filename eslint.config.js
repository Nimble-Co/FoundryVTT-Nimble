import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';

export default [
	js.configs.recommended,
	{
		files: [
			'src/**/*.{ts,js}',
			'lib/**/*.{ts,js}',
			'types/**/*.{ts,js}',
			'build/**/*.{ts,js}',
			'tests/**/*.{ts,js}',
		],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
			},
			globals: {
				...globals.browser,
				// Foundry VTT globals
				game: 'readonly',
				CONFIG: 'readonly',
				foundry: 'readonly',
				canvas: 'readonly',
				ui: 'readonly',
				Hooks: 'readonly',
				Roll: 'readonly',
				fromUuid: 'readonly',
				sheet: 'readonly',
				TextEditor: 'readonly',
				ChatMessage: 'readonly',
				Combat: 'readonly',
				Combatant: 'readonly',
				TokenDocument: 'readonly',
				Actor: 'readonly',
				Item: 'readonly',
				CONST: 'readonly',
				console: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
				},
			],
		},
	},
	{
		files: ['src/**/*.svelte', 'lib/**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tsparser,
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte'],
			},
			globals: {
				...globals.browser,
				// Foundry VTT globals
				game: 'readonly',
				CONFIG: 'readonly',
				foundry: 'readonly',
				canvas: 'readonly',
				ui: 'readonly',
				Hooks: 'readonly',
				Roll: 'readonly',
				fromUuid: 'readonly',
				sheet: 'readonly',
				TextEditor: 'readonly',
				ChatMessage: 'readonly',
				Combat: 'readonly',
				Combatant: 'readonly',
				TokenDocument: 'readonly',
				Actor: 'readonly',
				Item: 'readonly',
				CONST: 'readonly',
			},
		},
		plugins: {
			svelte,
			'@typescript-eslint': tseslint,
		},
		rules: {
			...svelte.configs.recommended.rules,
			...tseslint.configs.recommended.rules,
			// Add your custom rules here
			'no-unused-vars': 'off', // Turn off for Svelte files as it has false positives with reactive statements
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
				},
			],
		},
	},
];
