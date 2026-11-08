import { describe, expect, it } from 'vitest';
import { conditionRollModes } from '../conditionRollModes.js';

function creature(name: string, conditions: string[] = [], extra: Record<string, unknown> = {}) {
	return {
		name,
		uuid: `Actor.${name}`,
		getDomain: () => new Set(conditions.map((condition) => `self:${condition}`)),
		getTargetDomain: () => new Set(conditions.map((condition) => `target:${condition}`)),
		...extra,
	};
}

const steps = (lines: ReturnType<typeof conditionRollModes>) =>
	lines.map((line) => `${line.side}:${line.condition}:${line.step}`);

describe('conditionRollModes', () => {
	it('gives an attack on a Blinded target one advantage step', () => {
		const lines = conditionRollModes({
			kind: 'attack',
			roller: creature('Kael'),
			target: creature('Goblin', ['blinded']),
			delivery: 'melee',
		});

		expect(lines).toEqual([
			expect.objectContaining({
				condition: 'blinded',
				side: 'target',
				step: 1,
				on: true,
				name: 'Goblin',
			}),
		]);
	});

	it('gives one step per target condition, and they stack', () => {
		const lines = conditionRollModes({
			kind: 'attack',
			roller: creature('Kael'),
			// Grappled carries Restrained, and Paralyzed carries Incapacitated, as aliases do.
			target: creature('Goblin', [
				'blinded',
				'grappled',
				'restrained',
				'paralyzed',
				'incapacitated',
				'prone',
				'invisible',
			]),
			delivery: 'melee',
		});

		expect(steps(lines)).toEqual([
			'target:blinded:1',
			'target:grappled:1',
			'target:incapacitated:1',
			'target:prone:1',
			'target:invisible:-1',
		]);
	});

	it('gives a ranged attack on a Prone target disadvantage', () => {
		const target = creature('Goblin', ['prone']);
		const roller = creature('Kael');

		expect(
			steps(conditionRollModes({ kind: 'attack', roller, target, delivery: 'ranged' })),
		).toEqual(['target:prone:-1']);
	});

	it('offers both Prone lines, off, when the attack is neither melee nor ranged', () => {
		const lines = conditionRollModes({
			kind: 'attack',
			roller: creature('Kael'),
			target: creature('Goblin', ['prone']),
			delivery: null,
		});

		expect(lines.map((line) => [line.key, line.step, line.on])).toEqual([
			['target:prone:melee', 1, false],
			['target:prone:ranged', -1, false],
		]);
	});

	it('reads no target condition with no sole target, and none on a check', () => {
		const roller = creature('Kael');
		const target = creature('Goblin', ['blinded']);

		expect(conditionRollModes({ kind: 'attack', roller, target: null })).toEqual([]);
		expect(conditionRollModes({ kind: 'check', roller, target })).toEqual([]);
	});

	it('gives an attack the roller conditions first, also with no sole target', () => {
		const roller = creature('Kael', [
			'blinded',
			'prone',
			'invisible',
			'poisoned',
			'frightened',
			'despair',
		]);

		const lines = conditionRollModes({ kind: 'attack', roller, target: null });

		expect(steps(lines)).toEqual([
			'self:blinded:-1',
			'self:prone:-1',
			'self:invisible:1',
			'self:poisoned:-1',
			'self:frightened:-1',
			'self:despair:-1',
		]);
		expect(lines.every((line) => line.on && line.name === 'Kael')).toBe(true);
		expect(lines.find((line) => line.condition === 'frightened')?.ask).toBe('fearNearby');
		expect(lines.find((line) => line.condition === 'despair')?.ends).toBe(true);
		expect(lines.filter((line) => line.ends)).toHaveLength(1);
	});

	describe('Taunted', () => {
		const taunt = (origin: string | null, createdTime = 1) => ({
			statuses: new Set(['taunted']),
			origin,
			_stats: { createdTime },
		});
		const tauntedBy = (...effects: ReturnType<typeof taunt>[]) =>
			creature('Kael', ['taunted'], { effects });
		const ogre = creature('Ogre');
		const goblin = creature('Goblin');

		it('gives no disadvantage on an attack on the most recent taunter', () => {
			const roller = tauntedBy(
				taunt('Actor.Goblin.Item.taunt', 1),
				taunt('Actor.Ogre.Item.roar', 2),
			);

			expect(conditionRollModes({ kind: 'attack', roller, target: ogre })).toEqual([]);
			expect(steps(conditionRollModes({ kind: 'attack', roller, target: goblin }))).toEqual([
				'self:taunted:-1',
			]);
			expect(
				conditionRollModes({ kind: 'attack', roller, target: goblin })[0]?.ask,
			).toBeUndefined();
		});

		it('asks the table when the taunter or the target is not known', () => {
			const handToggled = tauntedBy(taunt(null));
			const fromCompendium = tauntedBy(taunt('Compendium.nimble.features.Item.taunt'));
			const known = tauntedBy(taunt('Actor.Ogre'));

			for (const [roller, target] of [
				[handToggled, ogre],
				[fromCompendium, ogre],
				[known, null],
			] as const) {
				const lines = conditionRollModes({ kind: 'attack', roller, target });
				expect(lines).toEqual([
					expect.objectContaining({ condition: 'taunted', step: -1, on: true, ask: 'taunter' }),
				]);
			}
		});

		it('reads the taunter of a token creature by its own uuid', () => {
			const roller = tauntedBy(taunt('Scene.s.Token.t.Actor.Ogre.Item.roar'));
			const tokenOgre = { ...creature('Ogre'), uuid: 'Scene.s.Token.t.Actor.Ogre' };

			expect(conditionRollModes({ kind: 'attack', roller, target: tokenOgre })).toEqual([]);
			expect(steps(conditionRollModes({ kind: 'attack', roller, target: ogre }))).toEqual([
				'self:taunted:-1',
			]);
		});

		it('does not change a check', () => {
			expect(conditionRollModes({ kind: 'check', roller: tauntedBy(taunt(null)) })).toEqual([]);
		});
	});

	it('gives a check only Poisoned and Frightened', () => {
		const roller = creature('Kael', ['blinded', 'prone', 'invisible', 'poisoned', 'frightened']);

		expect(steps(conditionRollModes({ kind: 'check', roller }))).toEqual([
			'self:poisoned:-1',
			'self:frightened:-1',
		]);
	});
});
