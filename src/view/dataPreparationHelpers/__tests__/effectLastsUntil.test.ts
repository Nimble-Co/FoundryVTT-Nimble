import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectLastsUntil, escapeOf, originName } from '../effectLastsUntil.js';

const zeroHp = {
	kind: 'event',
	boundary: null,
	clock: null,
	span: null,
	value: null,
	units: null,
	who: 'source',
	event: 'zeroHp',
	effectName: '',
};

const boss = { uuid: 'Actor.boss', name: 'Goblin Boss', documentName: 'Actor' };
const faceMe = {
	uuid: 'Actor.boss.Item.faceMe',
	name: 'Face Me!',
	documentName: 'Item',
	actor: boss,
};

beforeEach(() => {
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => (uuid === faceMe.uuid ? faceMe : uuid === boss.uuid ? boss : null)),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('effectLastsUntil', () => {
	it('names the creature of the origin item for its holder', () => {
		const effect = { origin: faceMe.uuid, system: { lastsUntil: [zeroHp] } };

		expect(effectLastsUntil(effect, { uuid: 'Actor.hero' })).toBe(
			'Until Goblin Boss drops to 0 HP',
		);
		expect(originName(effect)).toBe('Face Me!');
	});

	it('reads "you" when the holder is the source', () => {
		const effect = { origin: faceMe.uuid, system: { lastsUntil: [zeroHp] } };

		expect(effectLastsUntil(effect, boss)).toBe('Until you drop to 0 HP');
	});

	it('reads the core duration of an older effect, and an Escape with no moment', () => {
		expect(effectLastsUntil({ _source: { duration: { value: 3, units: 'rounds' } } }, null)).toBe(
			'For 3 rounds',
		);
		expect(effectLastsUntil({ system: { lastsUntil: [], escape: { dc: '13' } } }, null)).toBe(
			'Until you Escape',
		);
		expect(effectLastsUntil({}, null)).toBe('');
	});
});

describe('escapeOf', () => {
	const hero = { documentName: 'Actor', type: 'character', getRollData: () => ({}) };
	const grab = (fields: Record<string, unknown> = {}) => ({
		isOwner: true,
		origin: null,
		parent: hero,
		system: { escape: { dc: '13', saves: 'strOrDex' } },
		...fields,
	});

	it('gives the owner the Escape DC of an effect on the actor', () => {
		expect(escapeOf(grab())).toEqual({ dc: 13 });
	});

	it('gives no Escape for an effect on an item, with no DC, or for a user who does not own it', () => {
		expect(escapeOf(grab({ parent: { documentName: 'Item' } }))).toBeNull();
		expect(escapeOf(grab({ system: { escape: { dc: ' ', saves: 'any' } } }))).toBeNull();
		expect(escapeOf(grab({ isOwner: false }))).toBeNull();
	});
});
