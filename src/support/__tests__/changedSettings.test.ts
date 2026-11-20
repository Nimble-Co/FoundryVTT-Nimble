import { describe, expect, it } from 'vitest';
import { changedSettings } from '../changedSettings.js';

const words = (key: string, data: Record<string, string> = {}) =>
	`${key}${Object.keys(data).length ? `(${Object.values(data).join(',')})` : ''}`;

describe('changedSettings', () => {
	it('lists the settings that are not at their defaults, with readable values', () => {
		const rows = changedSettings(
			[
				{
					key: 'automation.applyRuleEffects',
					scope: 'world',
					name: 'Rule Effects',
					default: true,
					value: false,
				},
				{ key: 'debugMode', scope: 'client', name: 'Debug Mode', default: false, value: false },
				{
					key: 'customSpellSchools',
					scope: 'world',
					name: '',
					default: [],
					value: [{ id: 'a' }, { id: 'b' }],
				},
				{ key: 'combatTrackerCtWidthLevel', scope: 'client', default: 2, value: 3 },
			],
			words,
		);

		expect(rows).toEqual([
			{
				scope: 'client',
				key: 'combatTrackerCtWidthLevel',
				label: 'combatTrackerCtWidthLevel',
				value: '3',
			},
			{ scope: 'world', key: 'automation.applyRuleEffects', label: 'Rule Effects', value: 'off' },
			{
				scope: 'world',
				key: 'customSpellSchools',
				label: 'customSpellSchools',
				value: 'entries(2)',
			},
		]);
	});

	it('shows a value that writes itself as text, such as a colour, as that text', () => {
		const colour = { toJSON: () => '#123456' };
		const rows = changedSettings(
			[
				{ key: 'dieColor', scope: 'user', default: '#8a1c1c', value: colour },
				{
					key: 'labelColor',
					scope: 'user',
					default: '#f5e7c1',
					value: { toJSON: () => '#f5e7c1' },
				},
				{ key: 'customConditions', scope: 'world', default: {}, value: { a: 1 } },
			],
			words,
		);

		expect(rows).toEqual([
			{ scope: 'user', key: 'dieColor', label: 'dieColor', value: '#123456' },
			{
				scope: 'world',
				key: 'customConditions',
				label: 'customConditions',
				value: 'entriesOne(1)',
			},
		]);
	});

	it('leaves out the state that the system writes itself', () => {
		const rows = changedSettings(
			[
				{ key: 'worldSchemaVersion', scope: 'world', default: 0, value: 90 },
				{ key: 'migrationReports', scope: 'world', default: [], value: [{}] },
			],
			words,
		);

		expect(rows).toEqual([]);
	});
});
