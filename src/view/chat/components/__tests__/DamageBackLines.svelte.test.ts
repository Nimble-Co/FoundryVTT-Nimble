import { describe, expect, it } from 'vitest';
import type { DamageBackRecord } from '#documents/chatMessage/cardDamageBack.ts';
import { damageBackButton, damageBackText } from '../DamageBackLines.svelte.ts';

function record(fields: Partial<DamageBackRecord> = {}): DamageBackRecord {
	return {
		id: 'r1',
		label: 'Spiked Shell',
		actorUuid: 'Actor.hero',
		attackerUuid: 'Actor.goblin',
		attackerName: 'Goblin',
		amount: 3,
		dealt: false,
		woundDoubles: false,
		doubled: false,
		...fields,
	};
}

const effect = { name: 'Smoldering' } as DamageBackRecord['effect'];

describe('damageBackText', () => {
	it('words each shape of the line: damage with or without armor, the effect, or both', () => {
		expect(damageBackText(record())).toBe('Spiked Shell: Goblin takes 3 damage, ignoring armor');
		expect(damageBackText(record({ ignoreArmor: false }))).toBe(
			'Spiked Shell: Goblin takes 3 damage',
		);
		expect(damageBackText(record({ effect }))).toBe(
			'Spiked Shell: Goblin takes 3 damage, ignoring armor, and gains Smoldering',
		);
		expect(damageBackText(record({ effect, ignoreArmor: false }))).toBe(
			'Spiked Shell: Goblin takes 3 damage and gains Smoldering',
		);
		expect(damageBackText(record({ amount: 0, effect }))).toBe(
			'Spiked Shell: Goblin gains Smoldering',
		);
	});

	it('shows twice the amount once a Wound doubled it', () => {
		expect(damageBackText(record({ doubled: true }))).toContain('takes 6 damage');
	});
});

describe('damageBackButton', () => {
	it('deals, applies, or does both', () => {
		expect(damageBackButton(record())).toBe('Deal 3 damage');
		expect(damageBackButton(record({ amount: 0, effect }))).toBe('Apply Smoldering');
		expect(damageBackButton(record({ effect }))).toBe('Deal 3 damage and apply Smoldering');
	});
});
