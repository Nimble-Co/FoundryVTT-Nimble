import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Guiding Spirit pack item', () => {
	const item = JSON.parse(
		readFileSync(
			resolve('packs/classFeatures/core/shepherd/sacred-graces/guiding-spirit.json'),
			'utf8',
		),
	);

	it('has the rule that reads Lifebinding Spirit at a face of 6 or higher', () => {
		expect(item.system.rules).toHaveLength(1);
		expect(item.system.rules[0]).toMatchObject({
			type: 'dieResultEffect',
			itemIdentifier: 'lifebinding-spirit',
			atLeast: 6,
		});
	});

	it('has the effect that gives the next attack against the target advantage', () => {
		const effects = item.effects.filter((effect: { transfer: boolean }) => !effect.transfer);
		expect(effects).toHaveLength(1);
		const [effect] = effects;
		expect(effect.name).toBe('Guiding Spirit');
		expect(effect.system.rules).toEqual([
			expect.objectContaining({
				type: 'heldRoll',
				heldKind: 'advantage',
				value: 1,
				whichRoll: 'attacksOnHolder',
				usedUp: true,
			}),
		]);
		expect(effect.system.lastsUntil).toEqual([
			expect.objectContaining({ kind: 'event', event: 'combatEnd' }),
		]);
		expect(effect.system.escape).toEqual({ dc: '', saves: ['strength', 'dexterity'] });
	});
});
