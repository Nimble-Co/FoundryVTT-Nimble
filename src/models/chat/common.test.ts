import { describe, expect, it } from 'vitest';
import type { MovementOffer } from '#types/movement.js';
import type { MovementContext } from '../../utils/movement/movementContext.js';
import { grantedActionOffers, movementContext, movementOffers } from './common.js';

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
		};
		expect(Object.keys(field().element.fields).sort()).toEqual(Object.keys(stamped).sort());
	});

	it('starts an offer open and accepts every state it can settle into', () => {
		const { state, kind } = field().element.fields;
		expect(state.options.initial).toBe('open');
		expect(state.options.choices).toEqual(['open', 'taken', 'unused', 'lapsed']);
		expect(kind.options.choices).toEqual(['free', 'forced']);
	});
});

describe('movementContext schema factory', () => {
	type Field = {
		fields: {
			spacesMovedThisTurn: { options: { initial: unknown; nullable: boolean } };
			targetsSpacesAway: { options: { initial: unknown }; element: { fields: object } };
		};
	};
	const field = () => movementContext().movementContext as unknown as Field;

	it('starts with spaces moved unknown and no target', () => {
		const { spacesMovedThisTurn, targetsSpacesAway } = field().fields;
		expect(spacesMovedThisTurn.options.initial).toBeNull();
		expect(spacesMovedThisTurn.options.nullable).toBe(true);
		expect(targetsSpacesAway.options.initial).toEqual([]);
	});

	it('stores every field the stamp carries, so none is dropped when the card is saved', () => {
		const stamped: MovementContext = {
			spacesMovedThisTurn: 2,
			targetsSpacesAway: [{ tokenUuid: 'Scene.s.Token.tok', name: 'Goblin', spaces: 3 }],
		};
		expect(Object.keys(field().fields).sort()).toEqual(Object.keys(stamped).sort());
		expect(Object.keys(field().fields.targetsSpacesAway.element.fields).sort()).toEqual(
			Object.keys(stamped.targetsSpacesAway[0]).sort(),
		);
	});
});
