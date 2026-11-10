import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectLastsUntil, originName } from '../effectLastsUntil.js';

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
