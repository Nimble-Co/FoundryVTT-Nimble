import { afterEach, describe, expect, it, vi } from 'vitest';
import { Migration052ShadowmancerPilferedPower } from './Migration052ShadowmancerPilferedPower.js';

function shadowmancer(mana: Record<string, unknown> | undefined) {
	return {
		items: [{ type: 'class', system: { identifier: 'shadowmancer' } }],
		system: { resources: { mana } },
	};
}

describe('Migration052ShadowmancerPilferedPower.updateActor', () => {
	const migration = new Migration052ShadowmancerPilferedPower();
	const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

	afterEach(() => log.mockClear());

	it('clears a positive mana current and logs it', async () => {
		const source = shadowmancer({ current: 3 });

		await migration.updateActor(source);

		expect(source.system.resources.mana).toEqual({ current: 0 });
		expect(log).toHaveBeenCalledOnce();
	});

	it('leaves an undefined mana current alone without logging', async () => {
		const source = shadowmancer({});

		await migration.updateActor(source);

		expect(source.system.resources.mana).toEqual({});
		expect(log).not.toHaveBeenCalled();
	});

	it('leaves a zero mana current alone without logging', async () => {
		const source = shadowmancer({ current: 0 });

		await migration.updateActor(source);

		expect(source.system.resources.mana).toEqual({ current: 0 });
		expect(log).not.toHaveBeenCalled();
	});

	it('skips an actor with a non-Shadowmancer class', async () => {
		const source = {
			items: [
				{ type: 'class', system: { identifier: 'shadowmancer' } },
				{ type: 'class', system: { identifier: 'mage' } },
			],
			system: { resources: { mana: { current: 3 } } },
		};

		await migration.updateActor(source);

		expect(source.system.resources.mana.current).toBe(3);
		expect(log).not.toHaveBeenCalled();
	});
});
