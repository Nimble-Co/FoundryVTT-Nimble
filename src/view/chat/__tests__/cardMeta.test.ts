import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { partsText } from '#utils/documents/docLink.ts';
import { cardMeta } from '../cardMeta.js';

const ITEMS: Record<string, Record<string, unknown>> = {
	'Actor.hero.Item.sword': { name: 'Longsword', type: 'object', system: { identified: true } },
	'Actor.hero.Item.odd': {
		name: 'Vorpal Blade',
		type: 'object',
		system: { identified: false, unidentifiedName: 'Strange Sword' },
	},
	'Actor.boss.Item.strike': { name: 'Coordinated Strike!', type: 'feature', system: {} },
	'Actor.hero.Item.lunge': { name: 'Lunge', type: 'feature', system: {} },
};

const DAMAGE = { activation: { effects: [{ type: 'damage' }] } };

function card(
	system: Record<string, unknown>,
	flags: {
		itemUuid?: string;
		opportunityAttack?: boolean;
		origin?: { uuid: string };
		weaponUuid?: string;
	} = {},
) {
	return {
		system,
		flags: { [SYSTEM_ID]: { itemUuid: 'Actor.hero.Item.lunge', ...flags } },
	};
}

beforeEach(() => {
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => ITEMS[uuid] ?? null),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('cardMeta', () => {
	it('gives the outcome of an attack', () => {
		expect(cardMeta(card(DAMAGE))).toEqual(['Hit']);
		expect(cardMeta(card({ ...DAMAGE, isMiss: true }))).toEqual(['Miss']);
		expect(cardMeta(card({ ...DAMAGE, isCritical: true }))).toEqual(['Critical Hit']);
	});

	it('gives nothing for a card with no damage, and Healing only where asked', () => {
		const healing = { activation: { effects: [{ type: 'healing' }] } };
		expect(cardMeta(card({ activation: { effects: [] } }))).toBeNull();
		expect(cardMeta(card(healing))).toBeNull();
		expect(cardMeta(card(healing), { showsHealing: true })).toEqual(['Healing']);
	});

	it('names the feature the attack was made through as a link', () => {
		const parts = cardMeta(card(DAMAGE, { origin: { uuid: 'Actor.boss.Item.strike' } }));
		expect(parts).toEqual([
			'Hit (',
			{ name: 'Coordinated Strike!', uuid: 'Actor.boss.Item.strike' },
			')',
		]);
	});

	it('shows no origin when the origin is the card item itself', () => {
		expect(cardMeta(card(DAMAGE, { origin: { uuid: 'Actor.hero.Item.lunge' } }))).toEqual(['Hit']);
	});

	it('names the weapon a feature attacked with as a link', () => {
		const parts = cardMeta(card(DAMAGE, { weaponUuid: 'Actor.hero.Item.sword' }));
		expect(parts).toEqual(['Hit with ', { name: 'Longsword', uuid: 'Actor.hero.Item.sword' }]);
	});

	it('names the weapon and the origin together', () => {
		const parts = cardMeta(
			card(
				{ ...DAMAGE, isMiss: true },
				{ weaponUuid: 'Actor.hero.Item.sword', origin: { uuid: 'Actor.boss.Item.strike' } },
			),
		);
		expect(partsText(parts ?? [])).toBe('Miss with Longsword (Coordinated Strike!)');
	});

	it('names an Unarmed Strike as plain text', () => {
		expect(cardMeta(card(DAMAGE, { weaponUuid: 'unarmedStrike' }))).toEqual([
			'Hit with ',
			{ name: 'Unarmed Strike' },
		]);
	});

	it('names a weapon that is not identified by its unidentified name', () => {
		const parts = cardMeta(card(DAMAGE, { weaponUuid: 'Actor.hero.Item.odd' }));
		expect(partsText(parts ?? [])).toBe('Hit with Strange Sword');
	});

	it('gives only the origin on a card with no outcome', () => {
		const parts = cardMeta(card({}, { origin: { uuid: 'Actor.boss.Item.strike' } }));
		expect(partsText(parts ?? [])).toBe('(Coordinated Strike!)');
	});

	it('marks an opportunity attack in the brackets', () => {
		expect(cardMeta(card(DAMAGE, { opportunityAttack: true }))).toEqual([
			'Hit (opportunity attack)',
		]);
		const withWeapon = cardMeta(
			card(DAMAGE, { opportunityAttack: true, weaponUuid: 'Actor.hero.Item.sword' }),
		);
		expect(partsText(withWeapon ?? [])).toBe('Hit with Longsword (opportunity attack)');
	});

	it('puts the origin after the opportunity attack mark, as a link', () => {
		const parts = cardMeta(
			card(DAMAGE, { opportunityAttack: true, origin: { uuid: 'Actor.boss.Item.strike' } }),
		);
		expect(parts).toEqual([
			'Hit (opportunity attack, ',
			{ name: 'Coordinated Strike!', uuid: 'Actor.boss.Item.strike' },
			')',
		]);
	});

	it('marks an opportunity attack on a card with no outcome', () => {
		expect(cardMeta(card({}, { opportunityAttack: true }))).toEqual(['(opportunity attack)']);
	});

	it('leaves out a weapon or origin that is not found', () => {
		const parts = cardMeta(
			card(DAMAGE, { weaponUuid: 'Actor.hero.Item.gone', origin: { uuid: 'Actor.x.Item.gone' } }),
		);
		expect(parts).toEqual(['Hit']);
	});
});
