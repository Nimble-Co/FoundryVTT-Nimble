import { describe, expect, it } from 'vitest';
import {
	effectsMonster,
	effectsMonsterContext,
	goblin,
	minion,
	monsterContext,
	soloMonster,
} from '../../../../../tests/fixtures/actorSheets/monsterFixtures.ts';
import { monsterEffectsTab } from '../monsterEffectsTab.ts';
import { monsterNotesTab } from '../monsterNotesTab.ts';
import { type MonsterSetting, monsterSettingsTab } from '../monsterSettingsTab.ts';

const FX = 'NIMBLE.actorSheet.shared.effects';
const SET = 'NIMBLE.actorSheet.monster.settings';

describe('monsterEffectsTab', () => {
	it('lists the active effects, the conditions on the monster and the passive effects, with counts', () => {
		const view = monsterEffectsTab(effectsMonster(), effectsMonsterContext());

		expect(
			view.groups.map((group) => [group.label, group.note, group.rows.map((r) => r.name)]),
		).toEqual([
			[`${FX}.active`, '1', ['Bless']],
			['NIMBLE.actorSheet.monster.effects.conditionsOn', '1', ['Dazed']],
			[`${FX}.passive`, '1', ['Thick Hide']],
		]);
	});

	it('removes an effect or a condition of the monster after a question', () => {
		const [active, conditions] = monsterEffectsTab(
			effectsMonster(),
			effectsMonsterContext(),
		).groups;

		expect(active.rows[0].use).toMatchObject({
			kind: 'ask',
			ask: { intent: { kind: 'removeEffect', effectId: 'bless', itemId: null } },
		});
		expect(conditions.rows[0].use).toMatchObject({
			kind: 'ask',
			ask: { intent: { kind: 'setCondition', conditionId: 'dazed', active: false } },
		});
	});

	it('ends a toggle effect at once, and names the item of an item effect', () => {
		const monster = goblin();
		monster.items[0].rules = [
			{
				id: 'hideToggle',
				type: 'toggleEffect',
				active: true,
				fields: { endAfterInactiveRounds: 0 },
			},
		];
		monster.effects = [
			{
				id: 'hide',
				name: 'Hide',
				img: '',
				disabled: false,
				statuses: [],
				origin: null,
				itemId: null,
				toggle: { itemId: 'hahaMissedMe0001', ruleId: 'hideToggle' },
				temporary: true,
				duration: '',
				description: '',
			},
		];

		const [row] = monsterEffectsTab(monster, monsterContext()).groups[0].rows;

		expect(row.use).toMatchObject({ kind: 'act', intent: { kind: 'endEffect', effectId: 'hide' } });
		expect(row.summary).toBe(`${FX}.fromItem {"name":"Haha, Missed Me!"}`);
	});

	it('turns each condition of the system on or off from the grid', () => {
		const { conditions } = monsterEffectsTab(effectsMonster(), effectsMonsterContext());

		expect(conditions.options.map((option) => [option.id, option.on, option.intent])).toEqual([
			['dazed', true, { kind: 'setCondition', conditionId: 'dazed', active: false }],
			['frightened', false, { kind: 'setCondition', conditionId: 'frightened', active: true }],
			['prone', false, { kind: 'setCondition', conditionId: 'prone', active: true }],
		]);
	});
});

describe('monsterNotesTab', () => {
	it('gives the editor the notes of the monster, and the text that Foundry enriched', () => {
		const view = monsterNotesTab(goblin(), monsterContext({ enrichedNotes: '<p>enriched</p>' }));

		expect(view.notes).toMatchObject({
			field: 'system.description',
			value: expect.stringContaining('Green, cunning'),
			enriched: '<p>enriched</p>',
			empty: null,
		});
	});

	it('says so when there are no notes, and gives the import credit line', () => {
		const view = monsterNotesTab(
			soloMonster(),
			monsterContext({ importCredit: '<a href="https://example.com">Made by Ada</a>' }),
		);

		expect(view.notes.empty).toBe('NIMBLE.actorSheet.monster.notes.none');
		expect(view.credit).toBe('<a href="https://example.com">Made by Ada</a>');
	});
});

describe('monsterSettingsTab', () => {
	const settingOf = (settings: MonsterSetting[], id: string) => {
		const setting = settings.find((entry) => entry.id === id);
		if (!setting) throw new Error(`no setting ${id}`);
		return setting;
	};
	const all = (view: ReturnType<typeof monsterSettingsTab>) =>
		view.groups.flatMap((group) => group.settings);

	it('shows the monster type, level, size and creature type as values that you read', () => {
		const [monster] = monsterSettingsTab(minion(), monsterContext()).groups;

		expect(monster.settings).toEqual([
			{
				kind: 'value',
				id: 'monsterType',
				label: `${SET}.monsterType`,
				value: 'TYPES.Actor.minion',
			},
			{ kind: 'value', id: 'level', label: `${SET}.level`, value: '1/4' },
			{ kind: 'value', id: 'size', label: `${SET}.size`, value: 'Small' },
			{ kind: 'value', id: 'creatureType', label: `${SET}.creatureType`, value: 'Kobolds' },
		]);
	});

	it('gives each setting a short help line, and the groups of values one for all', () => {
		const view = monsterSettingsTab(goblin(), monsterContext());

		expect(view.groups.map((group) => [group.id, group.hint])).toEqual([
			['monster', `${SET}.hints.monster`],
			['image', undefined],
			['items', undefined],
			['coins', `${SET}.hints.coins`],
		]);
		expect(
			all(view)
				.filter((entry) => entry.kind !== 'value' && !entry.id.startsWith('coin'))
				.map((entry) => entry.kind !== 'value' && entry.hint),
		).toEqual(['imageX', 'imageY', 'imageScale', 'runMacros'].map((id) => `${SET}.hints.${id}`));
	});

	it('sets the image offsets and scale, and the item macros, through flags', () => {
		const settings = all(
			monsterSettingsTab(
				goblin({ flags: { actorImageScale: 120, automaticallyExecuteAvailableMacros: false } }),
				monsterContext(),
			),
		);
		const scale = settingOf(settings, 'imageScale');
		const macros = settingOf(settings, 'runMacros');

		expect(scale).toMatchObject({ kind: 'number', value: 120 });
		expect(scale.kind === 'number' && scale.intent(90)).toEqual({
			kind: 'setFlag',
			flag: 'actorImageScale',
			value: 90,
		});
		expect(macros).toMatchObject({ kind: 'check', on: false });
		expect(macros.kind === 'check' && macros.intent(true)).toEqual({
			kind: 'setFlag',
			flag: 'automaticallyExecuteAvailableMacros',
			value: true,
		});
	});

	it('has a coin row that you type in all modes', () => {
		const gold = settingOf(
			all(monsterSettingsTab(goblin({ system: { currency: { gp: 12 } } }), monsterContext())),
			'coin-gp',
		);

		expect(gold).toMatchObject({ kind: 'number', value: 12, min: 0, always: true });
		expect(gold.kind === 'number' && gold.intent(3)).toEqual({
			kind: 'setCurrency',
			coin: 'gp',
			value: 3,
		});
	});

	it('runs the item macros by default', () => {
		const macros = settingOf(all(monsterSettingsTab(goblin(), monsterContext())), 'runMacros');

		expect(macros).toMatchObject({ on: true });
	});
});
