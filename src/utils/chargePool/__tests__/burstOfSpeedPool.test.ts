import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { applyRecoveryTriggersToPools, buildEffectiveChargePoolMap } from '../helpers.js';
import type { CharacterActorLike, ChargePoolMap } from '../types.js';

const ZEPHYR = 'packs/classFeatures/core/zephyr/zephyr-progression';

function packItem(file: string) {
	const data = JSON.parse(readFileSync(resolve(ZEPHYR, file), 'utf8'));
	const rules = (data.system.rules as Record<string, unknown>[]).map((rule) => ({ ...rule }));
	return {
		id: file.replace('.json', ''),
		name: data.name,
		flags: {},
		rules: new Map(rules.map((rule, index) => [String(index), rule])),
	};
}

function zephyr(files: string[]): CharacterActorLike {
	const items = files.map(packItem);
	return {
		type: 'character',
		system: { levelUpHistory: [] },
		items: { contents: items, get: (id: string) => items.find((item) => item.id === id) },
		rules: items.flatMap((item) => [...item.rules.values()]),
		flags: {},
		getDomain: () => new Set<string>(),
		getRollData: vi.fn(() => ({ dexterity: 4 })),
	} as unknown as CharacterActorLike;
}

function bursts(pools: ChargePoolMap): number {
	return Object.values(pools).find((pool) => pool.identifier === 'burst-of-speed')?.current ?? -1;
}

describe('Burst of Speed pool', () => {
	it('gains DEX Bursts when the hero rolls Initiative', () => {
		const actor = zephyr(['burst-of-speed.json']);
		const pools = applyRecoveryTriggersToPools(actor, buildEffectiveChargePoolMap(actor), [
			'onInitiativeRolled',
		]);
		expect(bursts(pools)).toBe(4);
	});

	it('gains no Bursts when the encounter starts', () => {
		const actor = zephyr(['burst-of-speed.json', 'windborne.json']);
		const pools = applyRecoveryTriggersToPools(actor, buildEffectiveChargePoolMap(actor), [
			'encounterStart',
		]);
		expect(bursts(pools)).toBe(0);
	});

	it('gains 1 more with Windborne, and 1 for each Wound with Kinetic Momentum, past DEX', () => {
		const actor = zephyr(['burst-of-speed.json', 'windborne.json', 'kinetic-momentum.json']);
		let pools = applyRecoveryTriggersToPools(actor, buildEffectiveChargePoolMap(actor), [
			'onInitiativeRolled',
		]);
		expect(bursts(pools)).toBe(5);
		for (let wound = 0; wound < 3; wound++) {
			pools = applyRecoveryTriggersToPools(actor, pools, ['onWound']);
		}
		expect(bursts(pools)).toBe(8);
	});
});
