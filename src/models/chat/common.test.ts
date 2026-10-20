import { describe, expect, it } from 'vitest';
import type { MovementOffer } from '#types/movement.js';
import type { IncomingReactionEntry, LastReroll } from '#utils/incomingReactionEntry.js';
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
	const lastRerollFields = () =>
		(rerollHistory().lastReroll as unknown as { fields: Fields }).fields;

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
			rerollTrigger: 'always',
			rerollWithDisadvantage: false,
			outcomeTrigger: 'always',
			usedAmount: null,
			usedPoolLabel: '',
			usedFaces: [],
		};
		expect(Object.keys(entryFields()).sort()).toEqual(Object.keys(stamped).sort());
	});

	it('stores every field of the last reroll', () => {
		const last: LastReroll = {
			entryId: 'e1',
			itemUuid: 'Actor.a.Item.i',
			label: 'Feature',
			actorUuid: 'Actor.a',
			previousResult: 7,
			previousWasCritical: false,
			newResult: 4,
			usesLeft: 1,
			woundsGained: 0,
		};
		expect(Object.keys(lastRerollFields()).sort()).toEqual(Object.keys(last).sort());
	});
});
