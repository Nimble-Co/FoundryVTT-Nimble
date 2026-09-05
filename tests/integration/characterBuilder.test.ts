/**
 * The character builder has to work for any class, not the ones it was written
 * against, so this builds every class in the packs and asks the system whether
 * each character is still owed anything. `getMissingLevelSelections()` is the
 * system's own audit, so a class whose progression the builder mishandles fails
 * here without the test needing to know that class's rules.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildCharacter, missingSelections } from './builders/buildCharacter.ts';
import { purgeTestDocuments, settle } from './liveHelpers.ts';

const PREFIX = 'V14 Builder';

let classNames: string[] = [];

beforeAll(async () => {
	await purgeTestDocuments(PREFIX);
	const pack = game.packs.get(`${game.system.id}.nimble-classes`)!;
	const index = await pack.getIndex();
	classNames = [
		...new Set(
			(index as unknown as { contents: Array<{ name: string }> }).contents.map((c) => c.name),
		),
	].sort();
}, 60_000);

afterAll(async () => {
	await purgeTestDocuments(PREFIX);
});

describe('the builder produces a complete character for any class', () => {
	test('every class at level 5 is owed nothing', { timeout: 300_000 }, async () => {
		// Collected so a failure names every broken class, not just the first.
		const owed: Array<{ className: string; missing: string[] }> = [];

		for (const className of classNames) {
			const actor = await buildCharacter({
				name: `${PREFIX} ${className}`,
				className,
				level: 5,
			});
			await settle(200);

			const missing = await missingSelections(actor);
			owed.push({
				className,
				missing: missing.map((gap) => `${gap.poolKey}@${gap.level}`),
			});
		}

		expect(owed.filter((entry) => entry.missing.length > 0)).toEqual([]);
	});
});
