import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Pack from '../lib/Pack.mjs';

const SOURCE_DIR = path.resolve(
	path.dirname(url.fileURLToPath(import.meta.url)),
	'../../packs/rules',
);

let pack;
let workingDir;

beforeAll(() => {
	workingDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nimble-rules-')), 'rules');
	fs.cpSync(SOURCE_DIR, workingDir, { recursive: true });

	pack = Pack.loadJSONFiles(workingDir);
	pack.cleanAndValidate();
});

afterAll(() => fs.rmSync(path.dirname(workingDir), { recursive: true, force: true }));

describe('Nimble Core Rules pack folders', () => {
	it('builds one folder per rules book', () => {
		expect(pack.folderDocuments.map((folder) => folder.name)).toEqual(['Core Rules']);
	});

	it('sorts the folder manually, so the chapters keep the book order', () => {
		expect(pack.folderDocuments[0].sorting).toBe('m');
	});

	it('puts every chapter in that folder', () => {
		const [folder] = pack.folderDocuments;
		const entries = [...pack.data.values()];

		expect(entries.length).toBeGreaterThan(0);
		for (const entry of entries) expect(entry.folder, entry.name).toBe(folder._id);
	});

	it('keeps the folder id stable across builds', () => {
		const rebuilt = Pack.loadJSONFiles(workingDir);
		rebuilt.cleanAndValidate();

		expect(rebuilt.folderDocuments[0]._id).toBe(pack.folderDocuments[0]._id);
	});
});
