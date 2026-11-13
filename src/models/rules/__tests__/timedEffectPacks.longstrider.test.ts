import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Json = Record<string, any>;

const FILE = 'packs/secretSpells/core/wind/longstrider.json';

const readItem = (file: string): Json =>
	JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf-8'));

describe('Longstrider', () => {
	it('is a tier 1 wind secret spell for 1 action that lasts 1 hour, with no Concentration', () => {
		const item = readItem(FILE);
		expect(item).toMatchObject({ name: 'Longstrider', type: 'spell' });
		expect(String(item._id)).toMatch(/^[A-Za-z0-9]{16}$/);
		expect(item.system).toMatchObject({ school: 'wind', tier: 1 });
		expect(item.system.properties.selected).toEqual(['secretSpell']);
		expect(item.system.activation.cost).toMatchObject({ type: 'action', quantity: 1 });
		expect(item.system.activation.duration).toMatchObject({ type: 'hour', quantity: 1 });
		expect(item.system.activation.targets.count).toBe(1);
		expect(item.system.properties.reach).toMatchObject({ min: 1 });
	});

	it('gives the touched creature +2 speed for 1 hour', () => {
		const item = readItem(FILE);
		expect(item.effects).toHaveLength(1);
		const effect = item.effects[0] as Json;
		expect(effect).toMatchObject({ name: 'Longstrider', transfer: false, statuses: [] });
		expect(effect.system.rules).toEqual([
			expect.objectContaining({ type: 'speedBonus', value: '2', movementType: null }),
		]);
		expect(effect.system.lastsUntil).toEqual([
			{
				kind: 'time',
				boundary: null,
				clock: null,
				span: null,
				value: 1,
				units: 'hours',
				who: null,
				event: null,
				effectName: '',
			},
		]);
		expect(item.system.activation.effects).toEqual([
			expect.objectContaining({
				type: 'applyEffect',
				effectId: effect._id,
				recipient: 'targets',
				parentContext: null,
				parentNode: null,
			}),
		]);
	});

	it('adds 1 creature for each upcast step', () => {
		const item = readItem(FILE);
		expect(item.system.scaling).toEqual({
			mode: 'upcast',
			deltas: [expect.objectContaining({ operation: 'addTargets', value: 1 })],
			choices: null,
		});
	});
});
