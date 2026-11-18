import { describe, expect, it } from 'vitest';
import { buildReport, reportText } from '../migrationReport.js';
import type { PlannedCopy } from '../planMigration.js';

const TITLES = new Map([
	[87, { title: 'Held changes become Held Roll rules', kind: 'structure' as const }],
	[88, { title: 'Lasts Until choices', kind: 'content' as const }],
	[89, { title: 'Timed effects content', kind: 'content' as const }],
]);

function copy(
	uuid: string,
	name: string,
	versions: number[],
	holder: PlannedCopy['holder'],
): PlannedCopy {
	return {
		uuid,
		rootUuid: uuid.split('.Item.')[0],
		documentName: 'Item',
		name,
		img: null,
		type: 'monsterFeature',
		sourceId: null,
		matchedByName: false,
		versions,
		excludable: true,
		holder,
	};
}

const constrict = copy('Actor.cobra.Item.constrict', 'Constrict', [87, 89], {
	kind: 'actor',
	actorName: 'Cobra Captain',
	actorUuid: 'Actor.cobra',
});
const whip = copy('Actor.gorm.Item.whip', 'Crackling Whip', [88], {
	kind: 'actor',
	actorName: 'Gorm',
	actorUuid: 'Actor.gorm',
});
const parry = copy('Actor.gorm.Item.parry', 'Parry', [89], {
	kind: 'actor',
	actorName: 'Gorm',
	actorUuid: 'Actor.gorm',
});

const constrictOnToken = (token: string) =>
	copy(`Scene.temple.Token.${token}.Actor.cobra.Item.constrict`, 'Constrict', [87], {
		kind: 'token',
		actorName: 'Cobra Captain',
		sceneName: 'Sunken Temple',
	});

const report = buildReport({
	copies: [constrict, whip, parry],
	excluded: new Set([constrict.uuid, whip.uuid]),
	applied: [
		{ ...constrict, versions: [87] },
		parry,
		constrictOnToken('t1'),
		constrictOnToken('t2'),
	],
	documents: new Map([
		[87, 3],
		[88, 0],
		[89, 1],
		[90, 83],
	]),
	shown: [{ level: 'error', message: 'Invalid roll formula: @key', count: 2 }],
	errors: [{ uuid: 'Actor.treant.Item.crush', name: 'Crush', version: 89, message: 'Bad rules' }],
	written: 1184,
	titles: new Map([
		...TITLES,
		[90, { title: 'Inspiration starts off', kind: 'structure' as const }],
	]),
	systemVersion: '0.11.0',
	fromSchema: 86,
	toSchema: 90,
	date: '2026-11-15T20:41:00.000Z',
});

describe('buildReport', () => {
	it('records the counts, and the copies kept out with only the changes they skipped', () => {
		expect(report).toEqual(
			expect.objectContaining({
				systemVersion: '0.11.0',
				fromSchema: 86,
				toSchema: 90,
				documents: 1184,
				copies: 1,
				keptOut: [
					{ name: 'Constrict', holder: constrict.holder, titles: ['Timed effects content'] },
					{ name: 'Crackling Whip', holder: whip.holder, titles: ['Lasts Until choices'] },
				],
				errors: [
					{
						name: 'Crush',
						uuid: 'Actor.treant.Item.crush',
						title: 'Timed effects content',
						message: 'Bad rules',
					},
				],
			}),
		);
	});

	it('lists each migration that changed something, with the copies it changed', () => {
		expect(
			(report.migrations ?? []).map((migration) => ({
				title: migration.title,
				documents: migration.documents,
				copies: migration.copies.map((group) => [group.name, group.holders.length]),
			})),
		).toEqual([
			{
				title: 'Held changes become Held Roll rules',
				documents: 3,
				copies: [['Constrict', 3]],
			},
			{ title: 'Timed effects content', documents: 1, copies: [['Parry', 1]] },
			{ title: 'Inspiration starts off', documents: 83, copies: [] },
		]);
	});

	it('keeps the popups shown during the run apart from the errors', () => {
		expect(report.shown).toEqual([
			{ level: 'error', message: 'Invalid roll formula: @key', count: 2 },
		]);
	});

	it('records a run that stopped and continued', () => {
		const continued = buildReport({
			copies: [],
			excluded: new Set(),
			applied: [],
			documents: new Map(),
			shown: [],
			errors: [],
			written: 3,
			titles: TITLES,
			systemVersion: '0.11.0',
			fromSchema: 86,
			toSchema: 90,
			date: '2026-11-16T09:00:00.000Z',
			stoppedRun: '2026-11-15T20:41:00.000Z',
		});

		expect(continued.stoppedRun).toBe('2026-11-15T20:41:00.000Z');
	});
});

describe('reportText', () => {
	it('writes the report as plain text with the given words', () => {
		const words = (key: string, data: Record<string, string> = {}) =>
			`${key}${Object.keys(data).length ? `(${Object.values(data).join(',')})` : ''}`;

		expect(reportText(report, words, (holder) => `on ${holder.actorName}`)).toBe(
			[
				'heading(0.11.0)',
				'version: 0.11.0 (86-90)',
				'date: 2026-11-15T20:41:00.000Z',
				'changed: documents(1184), copiesOne(1)',
				'keptOut: 2',
				'errors: 1',
				'',
				'Held changes become Held Roll rules: copies(3), documents(3)',
				'- Constrict: repeated(on Cobra Captain,3)',
				'Timed effects content: copiesOne(1), documentsOne(1)',
				'- Parry: on Gorm',
				'Inspiration starts off: documents(83)',
				'',
				'keptOutHeading',
				'- Constrict on Cobra Captain: Timed effects content',
				'- Crackling Whip on Gorm: Lasts Until choices',
				'structureStillRan',
				'',
				'errorsHeading',
				'- Crush (Timed effects content): Bad rules',
				'',
				'shownHeading',
				'- levelError, times(2): Invalid roll formula: @key',
			].join('\n'),
		);
	});
});
