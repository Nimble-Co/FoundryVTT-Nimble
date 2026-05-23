import { describe, expect, it } from 'vitest';
import { Migration025DiceConsumerSplit } from './Migration025DiceConsumerSplit.js';

type Rule = Record<string, unknown>;

function makeItemSource(rules: Rule[]): { name: string; system: { rules: Rule[] } } {
	return {
		name: 'Test Feature',
		system: { rules },
	};
}

describe('Migration025DiceConsumerSplit', () => {
	it('strips consumption + bonusOnAttackDelivery and adds a diceConsumer for autoBonus pools', async () => {
		const source = makeItemSource([
			{
				type: 'dicePool',
				id: 'fury-pool-base',
				identifier: 'fury',
				scope: 'item',
				dieSize: 'd4',
				max: '@key',
				initial: 'zero',
				consumption: 'autoBonus',
				bonusOnAttackDelivery: 'melee',
			},
		]);

		await new Migration025DiceConsumerSplit().updateItem(source);

		expect(source.system.rules).toHaveLength(2);

		const pool = source.system.rules.find((r) => r.type === 'dicePool')!;
		expect(pool.consumption).toBeUndefined();
		expect(pool.bonusOnAttackDelivery).toBeUndefined();

		const consumer = source.system.rules.find((r) => r.type === 'diceConsumer')!;
		expect(consumer.poolIdentifier).toBe('fury');
		expect(consumer.poolScope).toBe('item');
		expect(consumer.mode).toBe('autoBonus');
		expect(consumer.bonusOnAttackDelivery).toBe('melee');
	});

	it('strips consumption from manual pools without adding a consumer rule', async () => {
		const source = makeItemSource([
			{
				type: 'dicePool',
				id: 'judgment',
				identifier: 'judgment',
				scope: 'actor',
				dieSize: 'd6',
				max: '2',
				initial: 'max',
				consumption: 'manual',
			},
		]);

		await new Migration025DiceConsumerSplit().updateItem(source);

		expect(source.system.rules).toHaveLength(1);
		const pool = source.system.rules[0];
		expect(pool.consumption).toBeUndefined();
		expect(pool.bonusOnAttackDelivery).toBeUndefined();
	});

	it('is idempotent — running twice leaves the result unchanged', async () => {
		const source = makeItemSource([
			{
				type: 'dicePool',
				id: 'fury-pool-base',
				identifier: 'fury',
				scope: 'item',
				dieSize: 'd4',
				max: '@key',
				initial: 'zero',
				consumption: 'autoBonus',
				bonusOnAttackDelivery: 'melee',
			},
		]);

		const migration = new Migration025DiceConsumerSplit();
		await migration.updateItem(source);
		const afterFirst = structuredClone(source.system.rules);
		await migration.updateItem(source);

		expect(source.system.rules).toEqual(afterFirst);
		expect(source.system.rules.filter((r) => r.type === 'diceConsumer')).toHaveLength(1);
	});

	it('does not duplicate a diceConsumer rule that already targets the pool', async () => {
		const source = makeItemSource([
			{
				type: 'dicePool',
				id: 'fury-pool-base',
				identifier: 'fury',
				scope: 'item',
				dieSize: 'd4',
				max: '@key',
				initial: 'zero',
				consumption: 'autoBonus',
				bonusOnAttackDelivery: 'melee',
			},
			{
				type: 'diceConsumer',
				id: 'preexisting-consumer',
				poolIdentifier: 'fury',
				poolScope: 'item',
				mode: 'autoBonus',
				cost: '1',
				bonusOnAttackDelivery: 'melee',
			},
		]);

		await new Migration025DiceConsumerSplit().updateItem(source);

		const consumers = source.system.rules.filter((r) => r.type === 'diceConsumer');
		expect(consumers).toHaveLength(1);
		expect((consumers[0] as Rule).id).toBe('preexisting-consumer');
	});

	it('ignores items with no rules array', async () => {
		const source = { name: 'Plain', system: {} } as { name: string; system: { rules?: Rule[] } };
		await expect(new Migration025DiceConsumerSplit().updateItem(source)).resolves.toBeUndefined();
		expect(source.system.rules).toBeUndefined();
	});

	it('leaves unrelated rule types alone', async () => {
		const source = makeItemSource([
			{
				type: 'damageBonus',
				id: 'dmg',
				value: '+1',
			},
			{
				type: 'dicePool',
				id: 'fury-pool-base',
				identifier: 'fury',
				scope: 'item',
				consumption: 'autoBonus',
				bonusOnAttackDelivery: 'melee',
			},
		]);

		await new Migration025DiceConsumerSplit().updateItem(source);

		expect(source.system.rules.find((r) => r.type === 'damageBonus')).toEqual({
			type: 'damageBonus',
			id: 'dmg',
			value: '+1',
		});
	});
});
