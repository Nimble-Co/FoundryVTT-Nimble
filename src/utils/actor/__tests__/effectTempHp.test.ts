import { describe, expect, it, vi } from 'vitest';
import { takeBackTempHp, tempHpGrant } from '../effectTempHp.js';

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
