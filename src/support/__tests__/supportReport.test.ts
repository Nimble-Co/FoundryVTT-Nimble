import { describe, expect, it } from 'vitest';
import { githubIssueUrl, type SupportReport, supportReportText } from '../supportReport.js';

const words = (key: string, data: Record<string, string> = {}) =>
	`${key}${Object.keys(data).length ? `(${Object.values(data).join(',')})` : ''}`;

const report: SupportReport = {
	made: '2026-11-15T11:52:00.000Z',
	user: { name: 'Gamemaster', isGM: true },
	foundry: '14.350',
	nimble: '0.10.0',
	schema: 90,
	browser: 'Chrome 142 - Windows 11',
	world: { title: 'Sunken Temple', actors: 84, items: 312, scenes: 18 },
	modules: [{ id: 'dice-so-nice', version: '5.2.1' }],
	settings: [
		{ scope: 'world', key: 'automation.applyRuleEffects', label: 'Rule Effects', value: 'Off' },
	],
	errors: [
		{
			level: 'error',
			source: 'popup',
			packageId: null,
			message: 'Invalid roll formula: @key',
			stack: ['a (systems/nimble/nimble.js:1:1)', 'b (systems/nimble/nimble.js:2:1)'],
			count: 2,
		},
		{
			level: 'warning',
			source: 'uncaught',
			packageId: 'monks-tokenbar',
			message: 'TypeError: boom',
			stack: [],
			count: 1,
		},
	],
	dropped: 0,
	migration: {
		date: '2026-11-15T10:46:00.000Z',
		systemVersion: '0.10.0',
		fromSchema: 86,
		toSchema: 90,
		documents: 109,
		copies: 121,
		keptOut: 0,
		errors: 0,
		shown: 4,
	},
	actor: null,
};

describe('supportReportText', () => {
	it('writes every section, with each error once and its stack lines', () => {
		expect(supportReportText(report, words)).toBe(
			[
				'title',
				'made(2026-11-15T11:52:00.000Z,Gamemaster,gm)',
				'',
				'== section.versions ==',
				'foundry: 14.350',
				'nimble: schema(0.10.0,90)',
				'browser: Chrome 142 - Windows 11',
				'world: worldValue(Sunken Temple,84,312,18)',
				'',
				'== section.modules(1) ==',
				'dice-so-nice 5.2.1',
				'',
				'== section.settings(1) ==',
				'[world] Rule Effects (automation.applyRuleEffects) = Off',
				'',
				'== section.errors(2,3) ==',
				'entry(level.error,2,source.popup): Invalid roll formula: @key',
				'    at a (systems/nimble/nimble.js:1:1)',
				'    at b (systems/nimble/nimble.js:2:1)',
				'entry(level.warning,1,uncaughtFrom(monks-tokenbar)): TypeError: boom',
				'',
				'== section.migration ==',
				'migrationLine(2026-11-15T10:46:00.000Z,0.10.0,86,90,109,121,0,0,4)',
			].join('\n'),
		);
	});

	it('says None for an empty section, and adds the actor when it is chosen', () => {
		const text = supportReportText(
			{
				...report,
				modules: [],
				errors: [],
				dropped: 0,
				migration: null,
				actor: { name: 'Bandit Gorm', type: 'npc', json: '{"name":"Bandit Gorm"}' },
			},
			words,
		);

		expect(text).toContain('== section.modules(0) ==\nnone\n');
		expect(text).toContain('== section.errors(0,0) ==\nnone\n');
		expect(text).toContain('== section.migration ==\nnone\n');
		expect(text.endsWith('== section.actor(Bandit Gorm,npc) ==\n{"name":"Bandit Gorm"}')).toBe(
			true,
		);
	});

	it('notes the entries the log could not keep', () => {
		expect(supportReportText({ ...report, dropped: 7 }, words)).toContain('dropped(7)');
	});
});

describe('githubIssueUrl', () => {
	it('opens the bug form with both versions filled in', () => {
		expect(githubIssueUrl('14.350', '0.10.0')).toBe(
			'https://github.com/Nimble-Co/FoundryVTT-Nimble/issues/new?template=bug.yml&foundry-version=14.350&nimble-version=0.10.0',
		);
	});
});
