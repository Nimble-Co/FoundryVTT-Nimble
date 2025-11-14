import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';

export default [
	js.configs.recommended,
	{
		files: ['**/*.{ts,js}'],
		languageOptions: {
			parser: tsparser,
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
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
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tsparser,
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
				'warn',
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
