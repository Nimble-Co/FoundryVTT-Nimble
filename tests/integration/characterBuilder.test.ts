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
	test('every class at level 5', { timeout: 300_000 }, async () => {
		const report: Array<{ cls: string; items: number; missing: number; err?: string }> = [];

		for (const className of classNames) {
			try {
				const actor = await buildCharacter({
					name: `${PREFIX} ${className}`,
					className,
					level: 5,
				});
				await settle(200);
				const missing = await missingSelections(actor);
				report.push({
					cls: className,
					items: (actor.items as unknown as { contents: unknown[] }).contents.length,
					missing: missing.length,
					gaps: missing.map((g) => `${g.poolKey}@${g.level}`),
				} as never);
			} catch (error) {
				report.push({
					cls: className,
					items: 0,
					missing: -1,
					err: (error as Error).message.slice(0, 80),
				});
			}
		}

		expect(report.filter((r) => r.err)).toEqual([]);
		expect(report.filter((r) => r.missing !== 0)).toEqual([]);
	});
});
