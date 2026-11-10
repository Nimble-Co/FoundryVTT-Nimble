import { describe, expect, it, vi } from 'vitest';
import { takeBackTempHp } from '../effectTempHp.js';

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
