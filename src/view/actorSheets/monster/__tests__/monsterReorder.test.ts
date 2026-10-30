import { describe, expect, it } from 'vitest';
import { dropPlace, type ReorderEntry, reorderIntent } from '../monsterReorder.ts';

const entry = (id: string, overrides: Partial<ReorderEntry> = {}): ReorderEntry => ({
	id,
	group: 'action',
	sequence: false,
	parentId: null,
	...overrides,
});

/** Bite (loose), then the sequence with Claw and Tail under it, and a feature in another group. */
const entries = [
	entry('bite'),
	entry('sequence', { sequence: true }),
	entry('claw', { parentId: 'sequence' }),
	entry('tail', { parentId: 'sequence' }),
	entry('sight', { group: 'feature' }),
];

/** The same, with a second sequence and its action Wing after Tail. */
const twoSequences = [
	...entries.slice(0, 4),
	entry('second', { sequence: true }),
	entry('wing', { parentId: 'second' }),
];

const sorts = (intent: ReturnType<typeof reorderIntent>) =>
	intent.kind === 'reorder' ? intent.updates : [];

describe('dropPlace', () => {
	it('puts a line above or below an action, with the sequence of that action', () => {
		expect(dropPlace(entries, 'bite', 'tail', true)).toEqual({
			position: 'above',
			parentId: 'sequence',
		});
		expect(dropPlace(entries, 'claw', 'bite', false)).toEqual({
			position: 'below',
			parentId: null,
		});
	});

	it('nests an action dropped below an attack sequence, and keeps it loose above one', () => {
		expect(dropPlace(entries, 'bite', 'sequence', false)).toEqual({
			position: 'nest',
			parentId: 'sequence',
		});
		expect(dropPlace(entries, 'claw', 'sequence', true)).toEqual({
			position: 'above',
			parentId: null,
		});
	});

	it('drops an attack sequence only on another one, never in one or among the loose actions', () => {
		expect(dropPlace(twoSequences, 'second', 'claw', true)).toBeNull();
		expect(dropPlace(twoSequences, 'second', 'bite', false)).toBeNull();
		expect(dropPlace(twoSequences, 'second', 'sequence', true)).toEqual({
			position: 'above',
			parentId: null,
		});
	});

	it('nests an action dropped above a later sequence in the sequence before it, where the line is', () => {
		expect(dropPlace(twoSequences, 'bite', 'second', true)).toEqual({
			position: 'above',
			parentId: 'sequence',
		});
	});

	it('moves an ability only inside its group, and not onto itself', () => {
		expect(dropPlace(entries, 'sight', 'bite', true)).toBeNull();
		expect(dropPlace(entries, 'bite', 'bite', true)).toBeNull();
		expect(dropPlace(entries, 'unknown', 'bite', true)).toBeNull();
	});
});

describe('reorderIntent', () => {
	it('gives the group its new order in steps of 10000, and the sequence of the dragged action', () => {
		const place = dropPlace(entries, 'bite', 'claw', false)!;

		expect(sorts(reorderIntent(entries, 'bite', 'claw', place))).toEqual([
			{ itemId: 'sequence', sort: 0 },
			{ itemId: 'claw', sort: 10000 },
			{ itemId: 'bite', sort: 20000, parentItemId: 'sequence' },
			{ itemId: 'tail', sort: 30000 },
		]);
	});

	it('puts a nested action right under its sequence', () => {
		const place = dropPlace(entries, 'bite', 'sequence', false)!;

		expect(sorts(reorderIntent(entries, 'bite', 'sequence', place)).map((u) => u.itemId)).toEqual([
			'sequence',
			'bite',
			'claw',
			'tail',
		]);
	});

	it('takes an action out of its sequence when it goes above the sequence', () => {
		const place = dropPlace(entries, 'tail', 'sequence', true)!;

		expect(sorts(reorderIntent(entries, 'tail', 'sequence', place))).toEqual([
			{ itemId: 'bite', sort: 0 },
			{ itemId: 'tail', sort: 10000, parentItemId: null },
			{ itemId: 'sequence', sort: 20000 },
			{ itemId: 'claw', sort: 30000 },
		]);
	});

	it('gives an attack sequence no parent', () => {
		const place = dropPlace(twoSequences, 'second', 'sequence', true)!;

		expect(sorts(reorderIntent(twoSequences, 'second', 'sequence', place))[1]).toEqual({
			itemId: 'second',
			sort: 10000,
		});
	});

	it('changes only the group of the dragged ability', () => {
		const features = [entry('sight', { group: 'feature' }), entry('smell', { group: 'feature' })];
		const all = [...entries.filter((e) => e.group !== 'feature'), ...features];
		const place = dropPlace(all, 'smell', 'sight', true)!;

		expect(sorts(reorderIntent(all, 'smell', 'sight', place))).toEqual([
			{ itemId: 'smell', sort: 0, parentItemId: null },
			{ itemId: 'sight', sort: 10000 },
		]);
	});
});
