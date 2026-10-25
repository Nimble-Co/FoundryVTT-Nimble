import { describe, expect, it } from 'vitest';
import type { MovementOffer } from '#types/movement.js';
import type {
	IncomingReactionEntry,
	PendingKeep,
	RerollRecord,
} from '#utils/incomingReactionEntry.js';
import { grantedActionOffers, incomingReactions, movementOffers, rerollHistory } from './common.js';

describe('grantedActionOffers schema factory', () => {
	it('defines an offers array that is empty by default', () => {
		const schema = grantedActionOffers();
		const field = schema.grantedActionOffers as unknown as { options: { initial: unknown } };
		expect(schema).toHaveProperty('grantedActionOffers');
		expect(field.options.initial).toEqual([]);
	});

	it('defines the per-offer fields the executor revalidates against', () => {
		const schema = grantedActionOffers();
		const element = (schema.grantedActionOffers as unknown as { element: { fields: object } })
			.element;
		const fieldNames = Object.keys(element.fields);

		expect(fieldNames).toEqual([
			'id',
			'targetActorUuid',
			'label',
			'activationType',
			'ruleId',
			'sourceItemUuid',
			'used',
			'usedBy',
		]);
	});

	it('starts offers unused with no consuming user', () => {
		const schema = grantedActionOffers();
		const element = (
			schema.grantedActionOffers as unknown as {
				element: { fields: Record<string, { options: { initial: unknown } }> };
			}
		).element;

		expect(element.fields.used.options.initial).toBe(false);
		expect(element.fields.usedBy.options.initial).toBeNull();
	});

	it('constrains the activation type to the closed weaponAttack set', () => {
		const schema = grantedActionOffers();
		const element = (
			schema.grantedActionOffers as unknown as {
				element: { fields: Record<string, { choices?: string[]; options: { initial: unknown } }> };
			}
		).element;

		expect(element.fields.activationType.choices).toEqual(['weaponAttack']);
		expect(element.fields.activationType.options.initial).toBe('weaponAttack');
	});
});

describe('movementOffers schema factory', () => {
	type Element = {
		element: { fields: Record<string, { options: { initial: unknown; choices?: unknown } }> };
		options: { initial: unknown };
	};
	const field = () => movementOffers().movementOffers as unknown as Element;

	it('defines an offers array that is empty by default', () => {
		expect(field().options.initial).toEqual([]);
	});

	it('stores every field an offer carries, so none is dropped when the card is saved', () => {
		const stamped: MovementOffer = {
			id: 'n1.tok',
			nodeId: 'n1',
			tokenUuid: 'Scene.s.Token.tok',
			name: 'Goblin',
			kind: 'forced',
			spaces: 2,
			ignoreDifficultTerrain: true,
			state: 'open',
			usedBy: null,
			movedSpaces: null,
			stopped: false,
			conditional: false,
		};
		expect(Object.keys(field().element.fields).sort()).toEqual(Object.keys(stamped).sort());
	});

	it('starts an offer open and accepts every state it can settle into', () => {
		const { state, kind } = field().element.fields;
		expect(state.options.initial).toBe('open');
		expect(state.options.choices).toEqual(['open', 'taken', 'unused', 'lapsed', 'untracked']);
		expect(kind.options.choices).toEqual(['free', 'forced']);
	});
});

describe('incomingReactions and rerollHistory schema factories', () => {
	type Fields = Record<string, unknown>;
	const entryFields = () =>
		(incomingReactions().incomingReactions as unknown as { element: { fields: Fields } }).element
			.fields;
	const rerollFields = () =>
		(rerollHistory().rerolls as unknown as { element: { fields: Fields } }).element.fields;

	it('stores every field an entry carries, so none is dropped when the card is saved', () => {
		const stamped: Required<IncomingReactionEntry> = {
			id: 'e1',
			kind: 'reroll',
			source: 'rule',
			actorUuid: 'Actor.a',
			tokenUuid: null,
			targetTokenUuid: 'Scene.s.Token.t',
			label: 'Feature',
			ruleId: 'r1',
			itemUuid: 'Actor.a.Item.i',
			used: false,
			side: 'target',
			oncePerAttack: false,
			rerollTrigger: 'always',
			rerollWithDisadvantage: false,
			outcomeTrigger: 'always',
			usedAmount: null,
			usedPoolLabel: '',
			usedFaces: [],
			leftOut: null,
		};
		expect(Object.keys(entryFields()).sort()).toEqual(Object.keys(stamped).sort());
	});

	it('accepts the legacy forceReroll kind and its fields, so old cards still validate', () => {
		const fields = entryFields() as Record<string, { choices?: string[] }>;
		expect(fields.kind.choices).toContain('forceReroll');
		expect(fields.rerollTrigger.choices).toEqual(['always', 'hit', 'criticalHit']);
		expect(fields).toHaveProperty('rerollWithDisadvantage');
	});

	it('stores every field of a reroll record', () => {
		const record: RerollRecord = {
			entryId: 'e1',
			itemUuid: 'Actor.a.Item.i',
			ruleId: 'r1',
			label: 'Feature',
			actorUuid: 'Actor.a',
			faces: 8,
			previous: { value: 8, outcome: 'crit' },
			next: { value: 4, outcome: null },
			usesLeft: 1,
			woundsGained: 0,
			kept: 'new',
			keptTotal: 12,
		};
		expect(Object.keys(rerollFields()).sort()).toEqual(Object.keys(record).sort());
		const die = (rerollFields().previous as { fields: Fields }).fields;
		expect(Object.keys(die).sort()).toEqual(Object.keys(record.previous ?? {}).sort());
	});

	it('stores every field of a waiting choice of result, and starts with none', () => {
		const pending: Required<PendingKeep> = {
			entryId: 'e1',
			chooserUuid: 'Actor.wren',
			roll: { class: 'DamageRoll' },
			reroll: {} as RerollRecord,
			old: { total: 9, outcome: 'miss' },
			new: { total: 12, outcome: 'hit' },
			discardedCritTriggers: false,
		};
		const field = rerollHistory().pendingKeep as unknown as {
			fields: Fields;
			options: { initial: unknown };
		};
		expect(Object.keys(field.fields).sort()).toEqual(Object.keys(pending).sort());
		expect(field.options.initial).toBeNull();
	});

	it('starts with no rerolls', () => {
		expect(
			(rerollHistory().rerolls as unknown as { options: { initial: unknown } }).options.initial,
		).toEqual([]);
	});
});
