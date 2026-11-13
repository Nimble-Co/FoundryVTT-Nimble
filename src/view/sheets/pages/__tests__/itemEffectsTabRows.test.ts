import { describe, expect, it } from 'vitest';
import { itemEffectsTabRows } from '../itemEffectsTabRows.ts';

const zeroHp = { kind: 'event', event: 'zeroHp', who: 'holder', effectName: '', boundary: null };

const applyNode = (id: string, effectId: string, recipient = 'targets') => ({
	id,
	type: 'applyEffect',
	effectId,
	recipient,
	parentContext: null,
	parentNode: null,
});

function itemWith(
	effects: Record<string, unknown>[],
	tree: unknown[] = [],
	rules: Record<string, unknown>[] = [],
) {
	return {
		system: { activation: { effects: tree }, rules },
		effects: new Map(effects.map((effect) => [effect.id as string, effect])),
	};
}

describe('itemEffectsTabRows', () => {
	it('names what uses each effect: Apply Effect nodes once, and each rule by label or type', () => {
		const item = itemWith(
			[{ id: 'fx', name: 'Taunted', img: 'taunt.svg', transfer: false }],
			[applyNode('n1', 'fx'), applyNode('n2', 'fx')],
			[
				{ id: 'r1', type: 'markTarget', label: 'Hunted', effectId: 'fx' },
				{ id: 'r2', type: 'applyCondition', effectId: 'fx' },
			],
		);

		const [row] = itemEffectsTabRows(item);

		expect(row.users).toEqual(['On use: Apply Effect', 'Rule: Hunted', 'Rule: Apply Condition']);
		expect(row.usedByLine).toBe(
			'Used by: On use: Apply Effect, Rule: Hunted, Rule: Apply Condition',
		);
		expect(row).toMatchObject({ id: 'fx', name: 'Taunted', img: 'taunt.svg', transfer: false });
	});

	it('says nothing uses an effect that no node or rule points at', () => {
		const [row] = itemEffectsTabRows(itemWith([{ id: 'fx', name: 'Loose', transfer: false }]));

		expect(row.users).toEqual([]);
		expect(row.usedByLine).toBe('Nothing uses this effect.');
		expect(row.img).toBe('icons/svg/aura.svg');
	});

	it('reads the Lasts Until for the targets, or for you when it is yours', () => {
		const lasting = (id: string, transfer: boolean) => ({
			id,
			name: id,
			transfer,
			system: { lastsUntil: [zeroHp] },
		});
		const item = itemWith(
			[lasting('a-targets', false), lasting('b-self', false), lasting('c-always', true)],
			[applyNode('n1', 'b-self', 'self')],
		);

		const rows = itemEffectsTabRows(item);

		expect(rows.map((row) => row.lasts)).toEqual([
			'Until they drop to 0 HP',
			'Until you drop to 0 HP',
			'Until you drop to 0 HP',
		]);
	});

	it('sorts the rows by name and splits them by transfer', () => {
		const item = itemWith([
			{ id: 'z', name: 'Zeal', transfer: true },
			{ id: 'a', name: 'Anger', transfer: false },
		]);

		expect(itemEffectsTabRows(item).map((row) => [row.name, row.transfer])).toEqual([
			['Anger', false],
			['Zeal', true],
		]);
	});
});
