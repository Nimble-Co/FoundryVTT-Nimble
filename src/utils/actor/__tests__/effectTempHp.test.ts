import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	followTempHpChange,
	giveTempHp,
	takeBackTempHp,
	tempGrantOptions,
	tempHpGrant,
} from '../effectTempHp.js';

function holder(temp: number) {
	return {
		name: 'Hero',
		system: { attributes: { hp: { temp } } },
		update: vi.fn(async () => undefined),
	};
}

describe('takeBackTempHp', () => {
	it('takes back only what is left of the temp HP that the effect gave', async () => {
		const hurt = holder(3);
		await takeBackTempHp(hurt, 6);
		expect(hurt.update).toHaveBeenCalledWith({ 'system.attributes.hp.temp': 0 });

		const more = holder(10);
		await takeBackTempHp(more, 6);
		expect(more.update).toHaveBeenCalledWith({ 'system.attributes.hp.temp': 4 });
	});

	it('does nothing for an effect that gave none', async () => {
		const target = holder(5);
		await takeBackTempHp(target, 0);
		await takeBackTempHp(target, null);
		expect(target.update).not.toHaveBeenCalled();
	});
});

describe('tempHpGrant', () => {
	it('gives all of it when it is more than the holder has', () => {
		expect(tempHpGrant(holder(2), 6, 0)).toEqual({ give: 6, owned: 6, refused: null });
	});

	it('gives none when the holder has as many, and takes over what a replaced copy left', () => {
		expect(tempHpGrant(holder(6), 6, 6)).toEqual({
			give: 0,
			owned: 6,
			refused: { temp: 6, amount: 6 },
		});
		expect(tempHpGrant(holder(4), 3, 6).owned, 'only what is left').toBe(4);
	});

	it('takes over what a replaced copy left also when it gives no temp HP', () => {
		expect(tempHpGrant(holder(5), null, 6)).toEqual({ give: 0, owned: 5, refused: null });
		expect(tempHpGrant(holder(5), null, 0).owned).toBe(0);
	});
});

/** A creature with effects that each own temp HP; an update writes its changes. */
function linkedHolder(temp: number, links: Record<string, number | null>) {
	const effects = Object.entries(links).map(([id, tempHp]) => {
		const effect = {
			id,
			system: { tempHp },
			update: vi.fn(async (data: Record<string, unknown>) => {
				effect.system.tempHp = data['system.tempHp'] as number | null;
			}),
		};
		return effect;
	});
	const creature = {
		name: 'Hero',
		system: { attributes: { hp: { temp } } },
		effects,
		update: vi.fn(async (data: Record<string, unknown>, options?: Record<string, unknown>) => {
			const before = creature.system.attributes.hp.temp;
			const temp = data['system.attributes.hp.temp'] as number;
			creature.system.attributes.hp.temp = temp;
			// The hook gets the changes expanded.
			await followTempHpChange(
				creature,
				{ system: { attributes: { hp: { temp } } } },
				{
					...options,
					[SYSTEM_ID]: {
						...(options?.[SYSTEM_ID] as object),
						previousHp: { value: 10, max: 10, temp: before },
					},
				},
			);
		}),
	};
	return creature;
}

const tempChange = (temp: number) => ({ 'system.attributes.hp.temp': temp });
const linkOf = (creature: ReturnType<typeof linkedHolder>, id: string) =>
	creature.effects.find((effect) => effect.id === id)?.system.tempHp;

describe('the temp HP link', () => {
	it('ends when the temp HP reach 0, so a potion after it stays', async () => {
		const hero = linkedHolder(10, { frost: 10 });

		await hero.update(tempChange(0));
		expect(linkOf(hero, 'frost')).toBeNull();

		await hero.update(tempChange(5));
		await takeBackTempHp(hero, linkOf(hero, 'frost'));
		expect(hero.system.attributes.hp.temp).toBe(5);
	});

	it('stays while a hit leaves some of the temp HP', async () => {
		const hero = linkedHolder(10, { frost: 10 });

		await hero.update(tempChange(4));

		expect(linkOf(hero, 'frost')).toBe(10);
	});

	it('ends for every effect when a heal or a hand edit raises the temp HP', async () => {
		const hero = linkedHolder(3, { frost: 6, ward: 4 });

		await hero.update(tempChange(8));

		expect([linkOf(hero, 'frost'), linkOf(hero, 'ward')]).toEqual([null, null]);
		expect(
			await followTempHpChange(hero, { system: { attributes: { hp: { temp: 8 } } } }, {}),
			'no link is left to end',
		).toEqual([]);
	});

	it('names the effects whose link it ends', async () => {
		const hero = linkedHolder(0, { frost: 6, ward: 2 });

		const ended = await followTempHpChange(
			hero,
			{ system: { attributes: { hp: { temp: 0 } } } },
			{},
		);

		expect(ended).toEqual(['frost', 'ward']);
	});

	it('moves to the new grant: the other links end', async () => {
		const hero = linkedHolder(3, { frost: 6, shield: null });

		await giveTempHp(hero, 12, 'shield');

		expect(hero.update).toHaveBeenCalledWith(tempChange(12), tempGrantOptions('shield'));
		expect(linkOf(hero, 'frost')).toBeNull();
	});

	it('ends for every effect on a grant that no effect owns, also with less temp HP', async () => {
		const hero = linkedHolder(9, { frost: 9 });

		await giveTempHp(hero, 4, null);

		expect(linkOf(hero, 'frost')).toBeNull();
	});

	it('does not change for an update that leaves the temp HP alone', async () => {
		const hero = linkedHolder(6, { frost: 6 });

		await followTempHpChange(hero, { system: { attributes: { hp: { value: 2 } } } }, {});

		expect(hero.effects[0]?.update).not.toHaveBeenCalled();
	});
});
