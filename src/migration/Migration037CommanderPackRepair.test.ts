import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { Migration037CommanderPackRepair } from './migrations/Migration037CommanderPackRepair.js';

const PACK_ROOT = join(process.cwd(), 'packs/classFeatures/core/commander');

const PACK_FILES = {
	commandingPresence: 'combat-tactics/commanding-presence.json',
	heavyStrike: 'combat-tactics/heavy-strike.json',
	inerrantStrike: 'combat-tactics/inerrant-strike.json',
	lungingStrike: 'combat-tactics/lunging-strike.json',
	sweepingStrike: 'combat-tactics/sweeping-strike.json',
	fieldMedic: 'commander-progression/field-medic.json',
	holdTheLine: 'commanders-order/hold-the-line.json',
	iCanDoThisAllDay: 'commanders-order/i-can-do-this-all-day.json',
	moveItMoveIt: 'commanders-order/move-it-move-it.json',
	tauntingStrike: 'commander-subclasses/champion-of-the-bulwark/taunting-strike.json',
} as const;

type PackKey = keyof typeof PACK_FILES;

interface PackActivation {
	acquireTargetsFromTemplate: boolean;
	cost: Record<string, unknown>;
	effects: Record<string, unknown>[];
	template: Record<string, unknown>;
}

interface PackDocument {
	_id: string;
	name: string;
	system: {
		class: string;
		rules: Record<string, unknown>[];
		activation: PackActivation;
	};
}

function readPackDocument(key: PackKey): PackDocument {
	return JSON.parse(readFileSync(join(PACK_ROOT, PACK_FILES[key]), 'utf-8')) as PackDocument;
}

/**
 * The state each feature shipped before the repair pass, transcribed because it
 * is history rather than something still on disk. Fields left out are unchanged
 * by the repair, so the pack value stands in for them.
 *
 * Eight of the ten carried the same placeholder: an `acid` / `0` damage node
 * whose only job was to hang one note under `on.hit`. These fixtures are what
 * every guard test varies from.
 */
interface LegacyState {
	rules?: Record<string, unknown>[];
	cost?: Record<string, unknown>;
	effects?: Record<string, unknown>[];
}

const LEGACY_STATE: Record<PackKey, LegacyState> = {
	commandingPresence: {
		effects: [
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
				id: '7JvhPSrNy39dL4jM',
				type: 'damage',
				damageType: 'acid',
				formula: '0',
				parentContext: null,
				parentNode: null,
				canCrit: true,
				canMiss: true,
				on: {
					hit: [
						{
							id: 'IsAy46e12s3J0Ao1',
							type: 'note',
							noteType: 'flavor',
							text: 'Combat tactics: 1/attack, you can expend a Combat Die to add one of the following effects to your attack.',
							parentContext: 'hit',
							parentNode: '7JvhPSrNy39dL4jM',
						},
					],
				},
			},
		],
	},
	heavyStrike: {
		effects: [
			{
				id: 'KYlDzNtEw6GU7F18',
				type: 'damage',
				damageType: 'acid',
				formula: '0',
				parentContext: null,
				parentNode: null,
				canCrit: false,
				canMiss: false,
				on: {
					hit: [
						{
							id: 'vvvjnGkqOAmif27A',
							type: 'note',
							noteType: 'flavor',
							text: 'Combat tactics: 1/attack, you can expend a Combat Die to add one of the following effects to your attack.',
							parentContext: 'hit',
							parentNode: 'KYlDzNtEw6GU7F18',
						},
					],
				},
			},
		],
	},
	inerrantStrike: {
		effects: [
			{
				id: 'QAVgiQieJEa3Z9kM',
				type: 'damage',
				damageType: 'acid',
				formula: '0',
				parentContext: null,
				parentNode: null,
				canCrit: false,
				canMiss: false,
				on: {
					hit: [
						{
							id: 'tlIdRtb6mhnZuJG2',
							type: 'note',
							noteType: 'flavor',
							text: 'Combat tactics: 1/attack, you can expend a Combat Die to add one of the following effects to your attack.',
							parentContext: 'hit',
							parentNode: 'QAVgiQieJEa3Z9kM',
						},
					],
				},
			},
		],
	},
	lungingStrike: {
		effects: [
			{
				id: 'XBG95BPpRB6MAyw8',
				type: 'damage',
				damageType: 'acid',
				formula: '0',
				parentContext: null,
				parentNode: null,
				canCrit: false,
				canMiss: false,
				on: {
					hit: [
						{
							id: 'NXsbvppkgMQJxeDe',
							type: 'note',
							noteType: 'flavor',
							text: 'Combat tactics: 1/attack, you can expend a Combat Die to add one of the following effects to your attack.',
							parentContext: 'hit',
							parentNode: 'XBG95BPpRB6MAyw8',
						},
					],
				},
			},
		],
	},
	sweepingStrike: {
		effects: [
			{
				id: 'RxCoShYLT1TasXls',
				type: 'damage',
				damageType: 'acid',
				formula: '0',
				parentContext: null,
				parentNode: null,
				canCrit: false,
				canMiss: false,
				on: {
					hit: [
						{
							id: 'Prn094f0MIvEpsDS',
							type: 'note',
							noteType: 'flavor',
							text: 'Combat tactics: 1/attack, you can expend a Combat Die to add one of the following effects to your attack.',
							parentContext: 'hit',
							parentNode: 'RxCoShYLT1TasXls',
						},
					],
				},
			},
		],
	},
	fieldMedic: {
		effects: [
			{
				id: 'iLb1tYfLk8DZypkn',
				type: 'healing',
				healingType: 'healing',
				formula: '@examination',
				parentContext: null,
				parentNode: null,
			},
			{
				id: 'nf3Bq7Mu65OWbwuG',
				type: 'damage',
				damageType: 'acid',
				formula: '0',
				parentContext: null,
				parentNode: null,
				canCrit: false,
				canMiss: false,
				on: {
					hit: [
						{
							id: 'A0krnEBgerU3KhXA',
							type: 'note',
							noteType: 'reminder',
							text: 'Examination bonus',
							parentContext: 'hit',
							parentNode: 'nf3Bq7Mu65OWbwuG',
						},
					],
				},
			},
		],
	},
	holdTheLine: {
		rules: [],
		effects: [
			{
				id: 'XH1nYBQmTOcSGSOD',
				type: 'damage',
				damageType: 'acid',
				formula: '0',
				parentContext: null,
				parentNode: null,
				canCrit: false,
				canMiss: false,
				on: {
					hit: [
						{
							id: 'uC0AteQ0SifbYMh7',
							type: 'note',
							noteType: 'warning',
							text: 'Set their HP to 3× your LVL.',
							parentContext: 'hit',
							parentNode: 'XH1nYBQmTOcSGSOD',
						},
					],
				},
			},
		],
	},
	iCanDoThisAllDay: {
		rules: [
			{
				type: 'maxHitDice',
				name: 'New Rule 1',
				id: '75GQq1kNmfQR1JzG',
			},
		],
		effects: [
			{
				id: 'KhEc8kQgCffaPLYS',
				type: 'damage',
				damageType: 'acid',
				formula: '0',
				parentContext: null,
				parentNode: null,
				canCrit: false,
				canMiss: true,
				on: {
					hit: [
						{
							id: 'O0SxGYEXguqDORKt',
							type: 'note',
							noteType: 'reminder',
							text: 'set HP = sum rolled Hit dice',
							parentContext: 'hit',
							parentNode: 'KhEc8kQgCffaPLYS',
						},
					],
				},
			},
		],
	},
	moveItMoveIt: {
		effects: [
			{
				id: 'Wyn3mgAxSL4q7pMp',
				type: 'damage',
				damageType: 'thunder',
				formula: '1d20+@attributes.initiative.mod',
				parentContext: null,
				parentNode: null,
				canCrit: false,
				canMiss: false,
				on: {
					hit: [
						{
							id: '2MD4a4v9xBkLj9Ra',
							type: 'damageOutcome',
							outcome: 'fullDamage',
							parentContext: 'hit',
							parentNode: 'Wyn3mgAxSL4q7pMp',
						},
						{
							id: 'JyS0bPpvH6ttPAoG',
							type: 'note',
							noteType: 'flavor',
							text: 'You can use this value as an advantage in your initiative. ',
							parentContext: 'hit',
							parentNode: 'Wyn3mgAxSL4q7pMp',
						},
					],
				},
			},
		],
	},
	tauntingStrike: {
		rules: [],
		cost: { details: '', quantity: 1, type: 'none', isReaction: false },
		effects: [],
	},
};

interface LegacyOverrides {
	name?: string;
	sourceId?: string;
	rules?: Record<string, unknown>[];
	cost?: Record<string, unknown>;
	effects?: Record<string, unknown>[];
}

function compendiumSourceId(packId: string): string {
	return `Compendium.nimble.nimble-class-features.Item.${packId}`;
}

/**
 * An embedded copy as it existed before the repair pass: the pack document with
 * the fields that changed rolled back to what they held then.
 */
function createLegacyItem(key: PackKey, overrides: LegacyOverrides = {}): any {
	const pack = readPackDocument(key);
	const legacy = LEGACY_STATE[key];

	return {
		type: 'feature',
		name: overrides.name ?? pack.name,
		system: {
			...structuredClone(pack.system),
			rules: structuredClone(overrides.rules ?? legacy.rules ?? pack.system.rules),
			activation: {
				...structuredClone(pack.system.activation),
				cost: structuredClone(overrides.cost ?? legacy.cost ?? pack.system.activation.cost),
				effects: structuredClone(
					overrides.effects ?? legacy.effects ?? pack.system.activation.effects,
				),
			},
		},
		_stats: { compendiumSource: overrides.sourceId ?? compendiumSourceId(pack._id) },
	};
}

/** The placeholder damage node a feature shipped, ready to be edited. */
function legacyPlaceholder(key: PackKey): any {
	const effects = LEGACY_STATE[key].effects;
	if (!effects) throw new Error(`No legacy effects recorded for ${key}`);
	return structuredClone(effects.at(-1)) as any;
}

describe('Migration037CommanderPackRepair', () => {
	let migration: Migration037CommanderPackRepair;

	beforeEach(() => {
		migration = new Migration037CommanderPackRepair();
	});

	it('should declare version 36', () => {
		expect(Migration037CommanderPackRepair.version).toBe(36);
		expect(migration.version).toBe(36);
	});

	describe('pack parity', () => {
		const keys = Object.keys(PACK_FILES) as PackKey[];

		it.each(keys)('should produce the pack rules verbatim for %s', async (key) => {
			// arrange
			const pack = readPackDocument(key);
			const item = createLegacyItem(key);

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual(pack.system.rules);
		});

		it.each(keys)('should produce the pack activation effects verbatim for %s', async (key) => {
			// arrange
			const pack = readPackDocument(key);
			const item = createLegacyItem(key);

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual(pack.system.activation.effects);
		});

		it.each(keys)('should produce the pack activation cost verbatim for %s', async (key) => {
			// arrange
			const pack = readPackDocument(key);
			const item = createLegacyItem(key);

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.cost).toEqual(pack.system.activation.cost);
		});

		it.each(keys)('should leave the template alone for %s', async (key) => {
			// arrange
			const pack = readPackDocument(key);
			const item = createLegacyItem(key);

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.template).toEqual(pack.system.activation.template);
		});
	});

	describe('idempotency', () => {
		const keys = Object.keys(PACK_FILES) as PackKey[];

		it.each(keys)('should be unchanged by a second run for %s', async (key) => {
			// arrange
			const pack = readPackDocument(key);
			const item = createLegacyItem(key);

			// act
			await migration.updateItem!(item);
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual(pack.system.rules);
			expect(item.system.activation.effects).toEqual(pack.system.activation.effects);
			expect(item.system.activation.cost).toEqual(pack.system.activation.cost);
		});

		it('should leave an already-migrated copy untouched', async () => {
			// arrange
			const pack = readPackDocument('tauntingStrike');
			const item = createLegacyItem('tauntingStrike', {
				rules: pack.system.rules,
				cost: pack.system.activation.cost,
				effects: pack.system.activation.effects,
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual(pack.system.rules);
			expect(item.system.activation.effects).toEqual(pack.system.activation.effects);
		});

		it('should not re-add a rule a GM already carries under the pack id', async () => {
			// arrange
			const item = createLegacyItem('holdTheLine', {
				rules: [{ type: 'chargePool', id: 'hold-the-line-use-pool' }],
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toHaveLength(2);
			expect(item.system.rules[0]).toEqual({ type: 'chargePool', id: 'hold-the-line-use-pool' });
		});
	});

	describe('matching', () => {
		it('should match by class and name when the copy has no source id', async () => {
			// arrange
			const pack = readPackDocument('moveItMoveIt');
			const item = createLegacyItem('moveItMoveIt');
			delete item._stats;

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual(pack.system.activation.effects);
		});

		it('should ignore a same-named feature belonging to another class', async () => {
			// arrange
			const item = createLegacyItem('tauntingStrike');
			delete item._stats;
			item.system.class = 'berserker';

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual([]);
			expect(item.system.activation.effects).toEqual([]);
		});

		it('should ignore documents that are not features', async () => {
			// arrange
			const item = createLegacyItem('tauntingStrike');
			item.type = 'object';

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual([]);
			expect(item.system.activation.effects).toEqual([]);
		});

		it('should ignore unrelated commander features', async () => {
			// arrange
			const item = createLegacyItem('heavyStrike', {
				name: 'Some Other Tactic',
				sourceId: compendiumSourceId('notACommanderFeature'),
			});
			const before = structuredClone(item.system.activation.effects);

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual(before);
		});
	});

	describe('placeholder damage nodes', () => {
		it('should drop the zero-damage node that emits a damage packet on every card', async () => {
			// arrange
			const item = createLegacyItem('heavyStrike');

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toHaveLength(1);
			expect(item.system.activation.effects[0].type).toBe('note');
		});

		it('should keep a placeholder a GM has given a real formula', async () => {
			// arrange
			const edited = legacyPlaceholder('heavyStrike');
			edited.formula = '2d6';
			const item = createLegacyItem('heavyStrike', { effects: [edited] });

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual([edited]);
		});

		it('should keep the node when a GM has reworded the nested reminder', async () => {
			// arrange
			const edited = legacyPlaceholder('holdTheLine');
			edited.on.hit[0].text = 'Set their HP to half your maximum instead.';
			const item = createLegacyItem('holdTheLine', { effects: [edited] });

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual([edited]);
		});

		it('should keep the node when a GM has added a second reminder beneath it', async () => {
			// arrange
			const edited = legacyPlaceholder('lungingStrike');
			edited.on.hit.push({
				id: 'gmAddedNote000001',
				type: 'note',
				noteType: 'reminder',
				text: 'House rule: only with a reach weapon.',
				parentContext: 'hit',
				parentNode: edited.id,
			});
			const item = createLegacyItem('lungingStrike', { effects: [edited] });

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual([edited]);
		});

		it('should preserve nodes a GM added alongside ours, and their order', async () => {
			// arrange
			const pack = readPackDocument('sweepingStrike');
			const gmNode = {
				id: 'gmAddedNode00001',
				type: 'note',
				noteType: 'reminder',
				text: 'House rule: the second target must be adjacent.',
				parentContext: null,
				parentNode: null,
			};
			const item = createLegacyItem('sweepingStrike', {
				effects: [gmNode, legacyPlaceholder('sweepingStrike')],
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual([gmNode, pack.system.activation.effects[0]]);
		});

		it('should leave the real damage node of Commanding Presence in place', async () => {
			// arrange
			const item = createLegacyItem('commandingPresence');
			const psychicNode = structuredClone(item.system.activation.effects[0]);

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects[0]).toEqual(psychicNode);
			expect(item.system.activation.effects[1].type).toBe('note');
		});

		it('should leave the healing node of Field Medic in place', async () => {
			// arrange
			const item = createLegacyItem('fieldMedic');
			const healingNode = structuredClone(item.system.activation.effects[0]);

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects[0]).toEqual(healingNode);
			expect(item.system.activation.effects[1].type).toBe('note');
		});

		it('should replace the initiative roll that applied itself as thunder damage', async () => {
			// arrange
			const item = createLegacyItem('moveItMoveIt');

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toHaveLength(1);
			expect(item.system.activation.effects[0].type).toBe('note');
		});

		it('should keep the initiative node when a GM has changed its formula', async () => {
			// arrange
			const edited = legacyPlaceholder('moveItMoveIt');
			edited.formula = '1d20';
			const item = createLegacyItem('moveItMoveIt', { effects: [edited] });

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual([edited]);
		});
	});

	describe('rule removal', () => {
		it('should remove the stale maxHitDice rule', async () => {
			// arrange
			const item = createLegacyItem('iCanDoThisAllDay');

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules.some((rule: any) => rule.type === 'maxHitDice')).toBe(false);
		});

		it('should keep a stale rule a GM has configured, and still add the pool', async () => {
			// arrange
			const pack = readPackDocument('iCanDoThisAllDay');
			const configured = {
				type: 'maxHitDice',
				name: 'House cap',
				id: '75GQq1kNmfQR1JzG',
				value: '3',
			};
			const item = createLegacyItem('iCanDoThisAllDay', { rules: [configured] });

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual([configured, ...pack.system.rules]);
		});

		it('should leave the rules of features with nothing to remove alone', async () => {
			// arrange
			const pack = readPackDocument('fieldMedic');
			const item = createLegacyItem('fieldMedic');

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.rules).toEqual(pack.system.rules);
			expect(item.system.rules).toHaveLength(1);
		});
	});

	describe('taunting strike', () => {
		it('should re-stamp the activation cost that was never spendable', async () => {
			// arrange
			const item = createLegacyItem('tauntingStrike');

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.cost).toEqual({
				details: '',
				quantity: 0,
				type: 'action',
				isReaction: false,
			});
		});

		it('should keep a cost a GM has already changed', async () => {
			// arrange
			const custom = { details: '', quantity: 2, type: 'action', isReaction: false };
			const item = createLegacyItem('tauntingStrike', { cost: custom });

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.cost).toEqual(custom);
		});

		it('should preserve unrelated cost fields while re-stamping', async () => {
			// arrange
			const item = createLegacyItem('tauntingStrike', {
				cost: { details: 'Only on your turn', quantity: 1, type: 'none', isReaction: false },
			});

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.cost).toEqual({
				details: 'Only on your turn',
				quantity: 0,
				type: 'action',
				isReaction: false,
			});
		});

		it('should keep a card a GM has already built', async () => {
			// arrange
			const gmNode = {
				id: 'gmBuiltNode00001',
				type: 'note',
				noteType: 'reminder',
				text: 'Taunted until the end of its next turn.',
				parentContext: null,
				parentNode: null,
			};
			const item = createLegacyItem('tauntingStrike', { effects: [gmNode] });

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toEqual([gmNode]);
		});

		it('should add the taunted condition and its reminder to an empty card', async () => {
			// arrange
			const item = createLegacyItem('tauntingStrike');

			// act
			await migration.updateItem!(item);

			// assert
			expect(item.system.activation.effects).toHaveLength(2);
			expect(item.system.activation.effects[0]).toMatchObject({
				type: 'condition',
				condition: 'taunted',
			});
		});
	});
});
