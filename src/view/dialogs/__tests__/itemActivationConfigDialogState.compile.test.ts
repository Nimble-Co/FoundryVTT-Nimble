import { readFileSync } from 'node:fs';
import path from 'node:path';
import { compileModule } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
	path.resolve(process.cwd(), 'src/view/dialogs/itemActivationConfigDialogState.svelte.ts'),
	'utf8',
);

function compileWarnings() {
	const javascript = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ESNext,
		},
	}).outputText;
	return compileModule(javascript, {
		filename: 'itemActivationConfigDialogState.svelte.js',
	}).warnings;
}

describe('the activation dialog state module', () => {
	it('does not capture conditionLines outside a reactive read', () => {
		const codes = compileWarnings().map((warning) => warning.code);

		expect(codes).not.toContain('state_referenced_locally');
	});
});
