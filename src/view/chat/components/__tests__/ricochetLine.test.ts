import { describe, expect, it } from 'vitest';
import { ricochetLineOf } from '../ricochetLine.js';

const KOBOLD = { uuid: 'Token.kobold', name: 'Kobold' };
const GOBLIN = { uuid: 'Token.goblin', name: 'Goblin' };

function card(record: { targetUuid?: string; applied?: boolean } = {}, hit = true) {
	return {
		ricochet: () => (hit ? { source: 'Trickshot', reach: 2 } : null),
		ricochetRecord: record,
		ricochetDamage: (uuid: string) => (uuid === KOBOLD.uuid ? 3 : 5),
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

	it('lets the GM apply it to the creature they target, which is not a target of the card', () => {
		const line = ricochetLineOf(card(), { targets: [GOBLIN, KOBOLD], isGM: true, names });

		expect(line?.action).toEqual({
			kind: 'apply',
			targetUuid: KOBOLD.uuid,
			label: 'Apply 3 Damage to Kobold',
			disabled: false,
		});
	});

	it('lets the player pick the creature they target, for the GM to apply', () => {
		const line = ricochetLineOf(card(), { targets: [KOBOLD], isGM: false, names });

		expect(line?.action).toEqual({
			kind: 'pick',
			targetUuid: KOBOLD.uuid,
			label: 'Ricochet to Kobold',
			disabled: false,
		});
	});

	it('asks for a target when there is none', () => {
		const line = ricochetLineOf(card(), { targets: [GOBLIN], isGM: false, names });

		expect(line?.action).toMatchObject({
			kind: 'pick',
			disabled: true,
			label: 'Target another creature',
		});
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

	it('has no button once applied', () => {
		const line = ricochetLineOf(card({ targetUuid: KOBOLD.uuid, applied: true }), {
			targets: [GOBLIN, KOBOLD],
			isGM: true,
			names,
		});

		expect(line).toMatchObject({ action: null, note: 'Applied to Kobold.' });
	});

	it('has no button for a player who does not own the card', () => {
		const line = ricochetLineOf(
			{ ...card(), isOwner: false },
			{ targets: [KOBOLD], isGM: false, names },
		);

		expect(line?.action).toBeNull();
	});
});
