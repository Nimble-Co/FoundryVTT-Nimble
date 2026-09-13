import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import commandingPresencePack from '../../../packs/classFeatures/core/commander/combat-tactics/commanding-presence.json';
import fitForAnyBattlefieldPack from '../../../packs/classFeatures/core/commander/commander-progression/fit-for-any-battlefield.json';
import holdTheLinePack from '../../../packs/classFeatures/core/commander/commanders-order/hold-the-line.json';
import allDayPack from '../../../packs/classFeatures/core/commander/commanders-order/i-can-do-this-all-day.json';
import { Migration053CommanderChecklist } from './Migration053CommanderChecklist.js';

const migration = new Migration053CommanderChecklist();

const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

beforeEach(() => log.mockClear());
afterEach(() => log.mockClear());

const OLD_HOLD_THE_LINE_NOTE = {
	id: 'uC0AteQ0SifbYMh7',
	type: 'note',
	noteType: 'warning',
	text: 'Set their HP to 3× your LVL.',
	parentContext: null,
	parentNode: null,
};

const OLD_HOLD_THE_LINE_DESCRIPTION =
	'<p><em>(1/encounter)</em> <strong>Reaction</strong> (when an ally drops to 0 HP): Command them to continue the fight! Set their HP to 3× your LVL. (M)</p>';

const OLD_ALL_DAY_DESCRIPTION =
	'<p><em>(1/encounter)</em> <strong>Reaction</strong> (when you would drop to 0 HP): You may expend any number of Hit Dice and set your HP to the sum rolled instead (do not add your STR). </p><p></p>';

const OLD_COMMANDING_PRESENCE_EFFECTS = [
	{
		id: '7PnCCAempcQf8NJd',
		type: 'damage',
		damageType: 'psychic',
		formula: '10+@strength',
		parentContext: null,
		parentNode: null,
		canCrit: false,
		canMiss: false,
		on: {
			hit: [
				{
					id: 'tQt7Kx8gVfpwCBjN',
					type: 'note',
					noteType: 'warning',
					text: '\n\nDC 10+STR (below)',
					parentContext: 'hit',
					parentNode: '7PnCCAempcQf8NJd',
				},
				{
					id: '63I1XqUXoUQvy4GU',
					type: 'damageOutcome',
					outcome: 'fullDamage',
					parentContext: 'hit',
					parentNode: '7PnCCAempcQf8NJd',
				},
			],
		},
	},
	{
		id: 'IsAy46e12s3J0Ao1',
		type: 'note',
		noteType: 'flavor',
		text: 'Combat tactics: 1/attack, you can expend a Combat Die to add one of the following effects to your attack.',
		parentContext: null,
		parentNode: null,
	},
];

/** The pack item as a world copy, stamped with the compendium id Foundry records. */
function fromPack(packItem: object): any {
	const source = structuredClone(packItem) as any;
	source._stats.compendiumSource = `Compendium.nimble.nimble-class-features.Item.${source._id}`;
	return source;
}

function oldFitForAnyBattlefield(): any {
	const source = fromPack(fitForAnyBattlefieldPack);
	const pool = source.system.rules.find((rule: any) => rule.id === 'combat-dice-pool');
	pool.recoveries = pool.recoveries.filter((r: any) => r.trigger !== 'encounterEnd');
	return source;
}

function oldHoldTheLine(): any {
	const source = fromPack(holdTheLinePack);
	source.system.activation.effects = [structuredClone(OLD_HOLD_THE_LINE_NOTE)];
	source.system.description = OLD_HOLD_THE_LINE_DESCRIPTION;
	return source;
}

function oldAllDay(): any {
	const source = fromPack(allDayPack);
	source.system.activation.cost.type = 'none';
	source.system.description = OLD_ALL_DAY_DESCRIPTION;
	return source;
}

function oldCommandingPresence(): any {
	const source = fromPack(commandingPresencePack);
	source.system.activation.effects = structuredClone(OLD_COMMANDING_PRESENCE_EFFECTS);
	return source;
}

function gmNote(id: string) {
	return {
		id,
		type: 'note',
		noteType: 'flavor',
		text: 'Table ruling.',
		parentContext: null,
		parentNode: null,
	};
}

describe('Migration053CommanderChecklist: Fit for Any Battlefield', () => {
	it('expires the Combat Dice pool when combat ends', async () => {
		const source = oldFitForAnyBattlefield();

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(fitForAnyBattlefieldPack.system.rules);
		expect(log).toHaveBeenCalledOnce();
	});

	it('leaves a feature that already expires the pool untouched', async () => {
		const source = fromPack(fitForAnyBattlefieldPack);

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(fitForAnyBattlefieldPack.system.rules);
		expect(log).not.toHaveBeenCalled();
	});

	it('keeps a rule the GM added', async () => {
		const source = oldFitForAnyBattlefield();
		const houseRule = { type: 'chargePool', id: 'house-pool', identifier: 'house' };
		source.system.rules.push(houseRule);

		await migration.updateItem(source);

		expect(source.system.rules.at(-1)).toEqual(houseRule);
	});

	it('leaves a GM-authored encounterEnd recovery alone', async () => {
		const source = oldFitForAnyBattlefield();
		const pool = source.system.rules.find((rule: any) => rule.id === 'combat-dice-pool');
		const houseRecovery = { trigger: 'encounterEnd', mode: 'refresh', value: '2' };
		pool.recoveries.push(houseRecovery);

		await migration.updateItem(source);

		expect(pool.recoveries.filter((r: any) => r.trigger === 'encounterEnd')).toEqual([
			houseRecovery,
		]);
	});

	it('does nothing on a second run', async () => {
		const source = oldFitForAnyBattlefield();
		await migration.updateItem(source);
		const afterFirstRun = structuredClone(source);

		await migration.updateItem(source);

		expect(source).toEqual(afterFirstRun);
	});
});

describe('Migration053CommanderChecklist: Hold the Line!', () => {
	it('replaces the warning with the healing and reminder the pack ships', async () => {
		const source = oldHoldTheLine();

		await migration.updateItem(source);

		expect(source.system.activation.effects).toEqual(holdTheLinePack.system.activation.effects);
	});

	it('drops the melee marker from the description', async () => {
		const source = oldHoldTheLine();

		await migration.updateItem(source);

		expect(source.system.description).toBe(holdTheLinePack.system.description);
	});

	it('leaves an already-healing feature untouched', async () => {
		const source = fromPack(holdTheLinePack);

		await migration.updateItem(source);

		expect(source.system.activation.effects).toEqual(holdTheLinePack.system.activation.effects);
		expect(log).not.toHaveBeenCalled();
	});

	it('keeps a node the GM added', async () => {
		const source = oldHoldTheLine();
		source.system.activation.effects.push(gmNote('gmHoldTheLine001'));

		await migration.updateItem(source);

		expect(source.system.activation.effects.at(-1)).toEqual(gmNote('gmHoldTheLine001'));
		expect(source.system.activation.effects).toHaveLength(3);
	});

	it('leaves a GM-edited note alone', async () => {
		const source = oldHoldTheLine();
		source.system.activation.effects[0].text = 'Set their HP to 4× your LVL.';

		await migration.updateItem(source);

		expect(source.system.activation.effects).toEqual([
			{ ...OLD_HOLD_THE_LINE_NOTE, text: 'Set their HP to 4× your LVL.' },
		]);
	});

	it('leaves a GM-edited description alone', async () => {
		const source = oldHoldTheLine();
		source.system.description = '<p>Our table sets their HP to 2× your LVL.</p>';

		await migration.updateItem(source);

		expect(source.system.description).toBe('<p>Our table sets their HP to 2× your LVL.</p>');
	});

	it('does nothing on a second run', async () => {
		const source = oldHoldTheLine();
		await migration.updateItem(source);
		const afterFirstRun = structuredClone(source);

		await migration.updateItem(source);

		expect(source).toEqual(afterFirstRun);
	});
});

describe('Migration053CommanderChecklist: I Can Do This ALL DAY!', () => {
	it('makes the order cost the reaction the pack ships', async () => {
		const source = oldAllDay();

		await migration.updateItem(source);

		expect(source.system.activation.cost).toEqual(allDayPack.system.activation.cost);
		expect(log).toHaveBeenCalledOnce();
	});

	it('trims the trailing empty paragraph from the description', async () => {
		const source = oldAllDay();

		await migration.updateItem(source);

		expect(source.system.description).toBe(allDayPack.system.description);
	});

	it('leaves a feature that already costs a reaction untouched', async () => {
		const source = fromPack(allDayPack);

		await migration.updateItem(source);

		expect(source.system.activation.cost).toEqual(allDayPack.system.activation.cost);
		expect(log).not.toHaveBeenCalled();
	});

	it('leaves a GM-edited cost alone', async () => {
		const source = oldAllDay();
		source.system.activation.cost.quantity = 2;

		await migration.updateItem(source);

		expect(source.system.activation.cost.type).toBe('none');
		expect(source.system.activation.cost.quantity).toBe(2);
	});

	it('leaves a GM-edited description alone', async () => {
		const source = oldAllDay();
		source.system.description = '<p>Expend Hit Dice, our way.</p>';

		await migration.updateItem(source);

		expect(source.system.description).toBe('<p>Expend Hit Dice, our way.</p>');
	});

	it('keeps the rules and effects the item carries', async () => {
		const source = oldAllDay();

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(allDayPack.system.rules);
		expect(source.system.activation.effects).toEqual(allDayPack.system.activation.effects);
	});

	it('does nothing on a second run', async () => {
		const source = oldAllDay();
		await migration.updateItem(source);
		const afterFirstRun = structuredClone(source);

		await migration.updateItem(source);

		expect(source).toEqual(afterFirstRun);
	});
});

describe('Migration053CommanderChecklist: Commanding Presence', () => {
	it('removes the damage and its flavor note', async () => {
		const source = oldCommandingPresence();

		await migration.updateItem(source);

		expect(source.system.activation.effects).toEqual(
			commandingPresencePack.system.activation.effects,
		);
		expect(log).toHaveBeenCalledOnce();
	});

	it('leaves a feature that already deals no damage untouched', async () => {
		const source = fromPack(commandingPresencePack);

		await migration.updateItem(source);

		expect(source.system.activation.effects).toEqual([]);
		expect(log).not.toHaveBeenCalled();
	});

	it('keeps a node the GM added', async () => {
		const source = oldCommandingPresence();
		source.system.activation.effects.push(gmNote('gmPresence000001'));

		await migration.updateItem(source);

		expect(source.system.activation.effects).toEqual([gmNote('gmPresence000001')]);
	});

	it('leaves a GM-edited damage formula alone', async () => {
		const source = oldCommandingPresence();
		source.system.activation.effects[0].formula = '10+@will';

		await migration.updateItem(source);

		expect(source.system.activation.effects).toHaveLength(2);
		expect(log).not.toHaveBeenCalled();
	});

	it('keeps a GM-edited flavor note when the damage goes', async () => {
		const source = oldCommandingPresence();
		source.system.activation.effects[1].text = 'Our table rolls this differently.';

		await migration.updateItem(source);

		expect(source.system.activation.effects).toEqual([
			{ ...OLD_COMMANDING_PRESENCE_EFFECTS[1], text: 'Our table rolls this differently.' },
		]);
	});

	it('does nothing on a second run', async () => {
		const source = oldCommandingPresence();
		await migration.updateItem(source);
		const afterFirstRun = structuredClone(source);

		await migration.updateItem(source);

		expect(source).toEqual(afterFirstRun);
	});
});

describe('Migration053CommanderChecklist: matching', () => {
	it('migrates a copy that lost its compendium id, by class and name', async () => {
		const source = oldHoldTheLine();
		delete source._stats.compendiumSource;

		await migration.updateItem(source);

		expect(source.system.activation.effects).toEqual(holdTheLinePack.system.activation.effects);
	});

	it('migrates a world-item copy, whose stored id names no compendium', async () => {
		const source = oldAllDay();
		source._stats.compendiumSource = 'Item.EBt3RmUmCcnHRDoq';

		await migration.updateItem(source);

		expect(source.system.activation.cost.type).toBe('action');
	});

	it('skips a feature of another class that shares the name', async () => {
		const source = oldHoldTheLine();
		delete source._stats.compendiumSource;
		source.system.class = 'berserker';

		await migration.updateItem(source);

		expect(source.system.activation.effects).toEqual([OLD_HOLD_THE_LINE_NOTE]);
		expect(source.system.description).toBe(OLD_HOLD_THE_LINE_DESCRIPTION);
	});

	it('skips a feature carrying another compendium id', async () => {
		const source = oldHoldTheLine();
		source._stats.compendiumSource = 'Compendium.homebrew.orders.Item.9BEzKcYWuIcKtmie';

		await migration.updateItem(source);

		expect(source.system.activation.effects).toEqual([OLD_HOLD_THE_LINE_NOTE]);
	});

	it('skips an item that is not a feature', async () => {
		const source = oldAllDay();
		source.type = 'object';

		await migration.updateItem(source);

		expect(source.system.activation.cost.type).toBe('none');
	});

	it('reads the dev-rebranded compendium id', async () => {
		const source = oldCommandingPresence();
		source.system.class = 'not-a-commander';
		source._stats.compendiumSource =
			'Compendium.nimble-dev.nimble-class-features.Item.cmrCy26QPZrZ0eFN';

		await migration.updateItem(source);

		expect(source.system.activation.effects).toEqual([]);
	});
});
