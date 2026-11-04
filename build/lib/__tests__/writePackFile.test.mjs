import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writePackFile } from '../writePackFile.mjs';

describe('writePackFile', () => {
	let dir;
	let file;
	const source = { name: 'Bite' };
	const text = '{\n\t"name": "Bite"\n}';

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-'));
		file = path.join(dir, 'item.json');
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true });
	});

	it('writes no final newline when the data changed', () => {
		fs.writeFileSync(file, '{"name":"Old"}\n');
		expect(writePackFile(file, source)).toBe(true);
		expect(fs.readFileSync(file, 'utf-8')).toBe(text);
	});

	it.each([
		['with no final newline', text],
		['with a final newline', `${text}\n`],
	])('does not touch a file %s when the data is the same', (_name, content) => {
		fs.writeFileSync(file, content);
		expect(writePackFile(file, source)).toBe(false);
		expect(fs.readFileSync(file, 'utf-8')).toBe(content);
	});
});
