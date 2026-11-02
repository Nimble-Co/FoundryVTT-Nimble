import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('chat card types', () => {
	it('each card data model is a document type in system.json', () => {
		const system = JSON.parse(readFileSync(resolve('public/system.json'), 'utf8'));
		const models = readFileSync(resolve('src/models/chat/chatDataModels.ts'), 'utf8');
		const block = /=\s*\{([^}]*)\}/.exec(models)?.[1] ?? '';
		const types = [...block.matchAll(/^\s*(\w+):/gm)].map((match) => match[1] as string);

		expect(types.length).toBeGreaterThan(10);
		expect(types.filter((type) => !(type in system.documentTypes.ChatMessage))).toEqual([]);
	});
});
