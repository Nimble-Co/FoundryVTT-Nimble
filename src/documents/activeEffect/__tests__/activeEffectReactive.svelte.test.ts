import { flushSync, tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { NimbleActiveEffect } from '../activeEffect.js';

type HookCallback = (effect: { uuid: string }) => void;

const make = (uuid: string) => {
	const effect = new (NimbleActiveEffect as unknown as new (data: object) => NimbleActiveEffect)(
		{},
	);
	Object.defineProperty(effect, 'uuid', { value: uuid });
	return effect;
};

describe('NimbleActiveEffect.reactive', () => {
	it('reruns a reader when this effect updates, not another', async () => {
		const on = vi.mocked(Hooks.on);
		const effect = make('Actor.a.ActiveEffect.taunted');
		let reads = 0;

		const stop = $effect.root(() => {
			$effect(() => {
				void effect.reactive;
				reads += 1;
			});
		});
		flushSync();
		const call = on.mock.calls.findLast(([hook]) => (hook as string) === 'updateActiveEffect');
		const onUpdate = call?.[1] as unknown as HookCallback;

		onUpdate({ uuid: 'Actor.a.ActiveEffect.other' });
		flushSync();
		expect(reads).toBe(1);

		onUpdate({ uuid: 'Actor.a.ActiveEffect.taunted' });
		flushSync();
		expect(reads).toBe(2);

		stop();
		await tick();
		expect(Hooks.off).toHaveBeenCalledWith('updateActiveEffect', expect.anything());
	});
});
