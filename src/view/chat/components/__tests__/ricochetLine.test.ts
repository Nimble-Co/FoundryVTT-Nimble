import { describe, expect, it } from 'vitest';
import { ricochetLineOf } from '../ricochetLine.js';

const KOBOLD = { uuid: 'Token.kobold', name: 'Kobold' };
const GOBLIN = { uuid: 'Token.goblin', name: 'Goblin' };

function card(
	record: { targetUuid?: string; applied?: boolean; amount?: number } = {},
	hit = true,
	thrownWeapon?: string,
) {
	const weapon = thrownWeapon ? { thrownWeapon, weaponUuid: 'Actor.cheat.Item.dagger' } : {};
	return {
		cardRicochet: {
			ricochet: () =>
				hit
					? { source: 'Trickshot', sourceUuid: 'Actor.cheat.Item.trickshot', reach: 2, ...weapon }
					: null,
			record,
			damage: (uuid: string) => (uuid === KOBOLD.uuid ? 3 : 5),
		},
		system: { targets: [GOBLIN.uuid] },
		isOwner: true,
	};
}

const names = (uuid: string) => [KOBOLD, GOBLIN].find((token) => token.uuid === uuid)?.name ?? '';

describe('the ricochet line', () => {
	it('is not there without a ricochet', () => {
		expect(ricochetLineOf(card({}, false), { targets: [KOBOLD], isGM: true, names })).toBeNull();
	});

	it('says what the ricochet does, with the reach', () => {
		const line = ricochetLineOf(card(), { targets: [], isGM: false, names });

		expect(line?.text).toBe(
			'Ricochet (Trickshot): half the damage, rounded down, to another creature within 2 spaces.',
		);
	});

	it('asks the table if the weapon was thrown, when only a throw ricochets', () => {
		const line = ricochetLineOf(card({}, true, 'Dagger'), { targets: [], isGM: false, names });

		expect(line?.text).toBe(
			'Ricochet (Trickshot), if you threw the Dagger: half the damage, rounded down, to another creature within 2 spaces.',
		);
	});

	it('links the feature and the weapon it names', () => {
		const line = ricochetLineOf(card({}, true, 'Dagger'), { targets: [], isGM: false, names });

		expect(line?.parts).toEqual([
			'Ricochet (',
			{ name: 'Trickshot', uuid: 'Actor.cheat.Item.trickshot' },
			'), if you threw the ',
			{ name: 'Dagger', uuid: 'Actor.cheat.Item.dagger' },
			': half the damage, rounded down, to another creature within 2 spaces.',
		]);
	});

	it('lets the GM apply it to the creature they target, which is not a target of the card', () => {
		const line = ricochetLineOf(card(), { targets: [GOBLIN, KOBOLD], isGM: true, names });

		expect(line?.action).toEqual({
			kind: 'apply',
			targetUuid: KOBOLD.uuid,
			label: 'Apply 3 Damage to Kobold',
		});
	});

	it('lets the player pick the creature they target, for the GM to apply', () => {
		const line = ricochetLineOf(card(), { targets: [KOBOLD], isGM: false, names });

		expect(line?.action).toEqual({
			kind: 'pick',
			targetUuid: KOBOLD.uuid,
			label: 'Ricochet to Kobold',
		});
	});

	it('asks for a target in text, with no button, when there is none', () => {
		for (const isGM of [false, true]) {
			const line = ricochetLineOf(card(), { targets: [GOBLIN], isGM, names });

			expect(line).toMatchObject({
				action: null,
				note: 'Target another creature for the ricochet.',
			});
		}
	});

	it('gives the GM the creature the player picked', () => {
		const picked = card({ targetUuid: KOBOLD.uuid });

		expect(ricochetLineOf(picked, { targets: [], isGM: true, names })?.action).toMatchObject({
			kind: 'apply',
			targetUuid: KOBOLD.uuid,
		});
		expect(ricochetLineOf(picked, { targets: [], isGM: false, names })).toMatchObject({
			action: null,
			note: 'Kobold takes it when the GM applies it.',
		});
	});

	it('says who took how much once applied, with no button', () => {
		const line = ricochetLineOf(card({ targetUuid: KOBOLD.uuid, applied: true, amount: 3 }), {
			targets: [GOBLIN, KOBOLD],
			isGM: true,
			names,
		});

		expect(line).toMatchObject({ action: null, note: 'Kobold took 3 damage.' });
	});

	it('has no button for a player who does not own the card', () => {
		const line = ricochetLineOf(
			{ ...card(), isOwner: false },
			{ targets: [KOBOLD], isGM: false, names },
		);

		expect(line?.action).toBeNull();
	});
});
