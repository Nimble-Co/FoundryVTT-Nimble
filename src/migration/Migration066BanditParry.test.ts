import { Migration066BanditParry } from './migrations/Migration066BanditParry.js';

function parry(rules: Array<Record<string, unknown>> = []) {
	return { type: 'feature', name: 'Parry.', system: { rules } };
}

describe('Migration066BanditParry', () => {
	it('adds the pack rule to an imported Bandit identified by source id', async () => {
		const item = parry();
		const actor = {
			name: 'Renamed Bandit',
			flags: {
				core: {
					sourceId: 'Compendium.nimble-dev.nimble-monsters.Actor.r9NnB02qiXpLFrcP',
				},
			},
		};

		await new Migration066BanditParry().updateItem(item, actor);

		expect(item.system.rules).toEqual([
			{
				type: 'modifyIncomingAttack',
				modifier: 'raiseMissThreshold',
				missThreshold: 2,
				label: '',
				id: 'HO3TDlnuYvNiYEP8',
			},
		]);
	});

	it('falls back to the seven canonical actor names when source metadata is absent', async () => {
		const item = parry();

		await new Migration066BanditParry().updateItem(item, { name: 'Bandit Mage' });

		expect(item.system.rules[0]).toEqual(
			expect.objectContaining({ id: '3TYU94lHKUs0N95b', missThreshold: 2 }),
		);
	});

	it('preserves an existing threshold rule and remains idempotent', async () => {
		const existing = {
			type: 'modifyIncomingAttack',
			modifier: 'raiseMissThreshold',
			missThreshold: 3,
			id: 'custom-parry',
		};
		const item = parry([existing]);
		const actor = { name: 'Bandit Captain' };

		await new Migration066BanditParry().updateItem(item, actor);
		await new Migration066BanditParry().updateItem(item, actor);

		expect(item.system.rules).toEqual([existing]);
	});

	it('does not change a same-named feature on an unrelated actor', async () => {
		const item = parry();

		await new Migration066BanditParry().updateItem(item, { name: 'Knight' });

		expect(item.system.rules).toEqual([]);
	});
});
