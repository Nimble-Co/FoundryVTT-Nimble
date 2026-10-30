import type {
	IncomingReactionEntry,
	RerollRecord,
} from '#utils/incomingReactions/incomingReactionEntry.ts';
import { withNewRerollEntries } from '#utils/reroll/rerollEntries.ts';
import { isRerollAgain, rerollAgainRecords, rerollHistoryLines } from '../rerollHistoryLines.ts';

const NAMES: Record<string, string> = {
	'Item.sand': 'Pocket Sand',
	'Item.ward': 'Warding Bond',
	'Actor.wren': 'Wren',
	'Actor.bram': 'Bram',
};

function record(overrides: Partial<RerollRecord> = {}): RerollRecord {
	return {
		entryId: 'sand-entry',
		itemUuid: 'Item.sand',
		ruleId: 'r1',
		label: 'Pocket Sand rule',
		actorUuid: 'Actor.wren',
		faces: 8,
		previous: { value: 8, outcome: 'crit' },
		next: { value: 3, outcome: null },
		usesLeft: null,
		woundsGained: 0,
		...overrides,
	};
}

function entry(overrides: Partial<IncomingReactionEntry> = {}): IncomingReactionEntry {
	return {
		id: 'waiting',
		kind: 'reroll',
		source: 'rule',
		actorUuid: 'Actor.wren',
		tokenUuid: null,
		targetTokenUuid: 'Scene.s.Token.t',
		label: 'Pocket Sand rule',
		ruleId: 'r1',
		itemUuid: 'Item.sand',
		used: false,
		...overrides,
	};
}

function lines(records: RerollRecord[], rerollAgain: RerollRecord[] = [], speakerUuid = '') {
	return rerollHistoryLines({
		records,
		speakerUuid,
		rerollAgain: new Set(rerollAgain),
		documentName: (uuid) => NAMES[uuid],
	});
}

describe('rerollHistoryLines', () => {
	it('gives one line per reroll in roll order, with the cost of each', () => {
		const button = record({ woundsGained: 1 });
		const automatic = record({
			entryId: 'ward-entry',
			itemUuid: 'Item.ward',
			actorUuid: 'Actor.bram',
			previous: { value: 3, outcome: null },
			next: { value: 1, outcome: 'miss' },
			usesLeft: 2,
		});

		expect(lines([button, automatic], [], 'Actor.wren')).toEqual([
			{
				title: 'Pocket Sand',
				tags: [],
				tempHpNote: null,
				offNote: null,
				text: 'Rerolled with Pocket Sand',
				detail: 'Wounds gained: 1',
				keptOld: false,
				dice: {
					previous: { faces: 8, value: 8, outcome: 'crit' },
					next: { faces: 8, value: 3, outcome: null },
				},
			},
			{
				title: 'Warding Bond',
				tags: [],
				tempHpNote: null,
				offNote: null,
				text: 'Rerolled with Warding Bond',
				detail: 'Used by Bram - Uses left: 2',
				keptOld: false,
				dice: {
					previous: { faces: 8, value: 3, outcome: null },
					next: { faces: 8, value: 1, outcome: 'miss' },
				},
			},
		]);
	});

	it('tells the total a player kept, and whether it was the old roll', () => {
		const [keptNew, keptOld] = lines([
			record({ kept: 'new', keptTotal: 12 }),
			record({ kept: 'old', keptTotal: 9 }),
		]);

		expect([keptNew.text, keptNew.keptOld]).toEqual(['Rerolled with Pocket Sand, kept 12', false]);
		expect([keptOld.text, keptOld.keptOld]).toEqual(['Rerolled with Pocket Sand, kept 9', true]);
	});

	it("leaves out the name on the speaker's own reroll", () => {
		const [line] = lines([record({ usesLeft: 1 })], [], 'Actor.wren');
		expect(line.detail).toBe('Uses left: 1');
	});

	it('names the one who rerolled when it is not the speaker', () => {
		const [line] = lines([record()], [], 'Actor.bram');
		expect(line.detail).toBe('Used by Wren');
	});

	it('leaves out the name and the uses left only on the lines of a "Reroll again" feature', () => {
		const sand = record({ usesLeft: 1, woundsGained: 1 });
		const ward = record({ itemUuid: 'Item.ward', actorUuid: 'Actor.bram', usesLeft: 2 });
		const sandAgain = record({ entryId: 'sand-2', usesLeft: 0 });

		expect(lines([sand, ward, sandAgain], [sand, sandAgain], 'Actor.bram')).toMatchObject([
			{ detail: 'Wounds gained: 1' },
			{ detail: 'Uses left: 2' },
			{ detail: null },
		]);
	});

	it('gives no dice when the die size or a result is unknown', () => {
		const result = lines([
			record({ faces: null }),
			record({ previous: null }),
			record({ next: null }),
		]);
		expect(result.map((line) => line.dice)).toEqual([null, null, null]);
		expect(result[0].text).toBe('Rerolled with Pocket Sand');
	});

	it('falls back to the record label when the feature is gone', () => {
		const [line] = lines([record({ itemUuid: 'Item.gone' })], [], 'Actor.wren');
		expect(line.text).toBe('Rerolled with Pocket Sand rule');
	});
});

describe('rerollHistoryLines, what a use changed and gave', () => {
	const courage = {
		key: 'Item.courage#r:rollMode',
		kind: 'rollMode' as const,
		label: 'Unfailing Courage',
		value: 1,
	};
	const ballad = {
		key: 'Item.ballad#r:extraDamage',
		kind: 'extraDamage' as const,
		label: 'Heroic Ballad',
		value: 3,
	};
	const gain = (name: string, extra: Record<string, unknown> = {}) => ({
		actorUuid: `Actor.${name}`,
		name,
		tempHp: { amount: 3, had: 0, keeps: null, source: 'Inspiring Presence' },
		actions: null,
		applied: true,
		...extra,
	});

	it('gives a tag per roll change, the dropped die in the advantage tooltip', () => {
		const [line] = lines([
			record({ next: { value: 4, outcome: null }, dropped: 2, changes: [courage, ballad] }),
		]);

		expect(line.title).toBe('Pocket Sand');
		expect(line.tags).toEqual([
			{
				kind: 'rollMode',
				label: 'Advantage',
				tooltip: 'Unfailing Courage. Rolled 4 and 2, kept 4.',
				off: false,
			},
			{
				kind: 'extraDamage',
				label: '+3 Heroic Ballad',
				tooltip: 'Heroic Ballad: +3 damage, in the total.',
				off: false,
			},
		]);
	});

	it('starts an automatic reroll with a tag that names the feature, and says so in the sentence', () => {
		const [line] = lines([record({ automatic: true, changes: [courage] })]);

		expect(line.tags[0]).toEqual({
			kind: 'automatic',
			label: 'Automatic',
			tooltip: 'Pocket Sand rerolled by itself. Nobody clicked.',
			off: false,
		});
		expect(line.tags.map((tag) => tag.kind)).toEqual(['automatic', 'rollMode']);
		expect(line.text).toBe('Rerolled automatically by Pocket Sand');
	});

	it('gives an action tag, a temp HP tag with its count, and the note that lists them', () => {
		const [line] = lines([
			record({
				grants: [
					gain('Wren', { actions: { amount: 1, reason: null, source: 'Fire in my Bones' } }),
					gain('Pip'),
					gain('Bram', { tempHp: { amount: 3, had: 5, keeps: 5, source: 'Inspiring Presence' } }),
					gain('Tam', { tempHp: { amount: 3, had: 1, keeps: null, source: 'Inspiring Presence' } }),
				],
			}),
		]);

		expect(line.tags).toEqual([
			{ kind: 'action', label: 'Wren +1 action', tooltip: 'Fire in my Bones', off: false },
			{
				kind: 'tempHp',
				label: '3 temp HP to 3 creatures',
				tooltip: 'Inspiring Presence',
				off: false,
			},
		]);
		expect(line.tempHpNote).toBe(
			'Wren, Pip gain 3 temp HP. Tam had 1, now has 3. Bram keeps 5, not 3. Temp HP does not add up. A creature can keep the other amount: change it on its sheet.',
		);
		expect(line.offNote).toBeNull();
	});

	it('puts an action that was not given last, with the reason', () => {
		const [line] = lines([
			record({
				grants: [
					gain('Wren', {
						actions: { amount: 0, reason: 'notInCombat', source: 'Fire in my Bones' },
					}),
				],
			}),
		]);

		expect(line.tags.map((tag) => [tag.kind, tag.label])).toEqual([
			['tempHp', '3 temp HP to Wren'],
			['noAction', 'No action: not in combat'],
		]);
	});

	it('names the one creature that gains temp HP, and says when nobody gains it', () => {
		const one = lines([record({ grants: [gain('Pip')] })])[0];
		const none = lines([
			record({
				grants: [
					gain('Bram', { tempHp: { amount: 3, had: 5, keeps: 5, source: 'Inspiring Presence' } }),
				],
			}),
		])[0];

		expect(one.tags[0].label).toBe('3 temp HP to Pip');
		expect(one.tempHpNote).toBe('Pip gains 3 temp HP.');
		expect(none.tags[0].label).toBe('3 temp HP: nobody gains it');
	});

	it('marks the temp HP and action tags off, with one note, when Feature Effects is off', () => {
		const [line] = lines([
			record({
				changes: [courage],
				grants: [
					gain('Wren', {
						applied: false,
						actions: { amount: 1, reason: null, source: 'Fire in my Bones' },
					}),
				],
			}),
		]);

		expect(line.tags.map((tag) => [tag.kind, tag.off])).toEqual([
			['rollMode', false],
			['action', true],
			['tempHp', true],
		]);
		expect(line.offNote).toBe('Feature Effects is off. Give the temp HP and the action by hand.');
	});
});

describe('isRerollAgain', () => {
	it('is true for a reroll of a feature that rerolled in this list', () => {
		expect(isRerollAgain(entry(), [record()])).toBe(true);
	});

	it('needs the same rule on the same feature and the same actor', () => {
		expect(isRerollAgain(entry({ actorUuid: 'Actor.bram' }), [record()])).toBe(false);
		expect(isRerollAgain(entry({ itemUuid: 'Item.ward' }), [record()])).toBe(false);
		expect(isRerollAgain(entry({ ruleId: 'r2' }), [record()])).toBe(false);
		expect(isRerollAgain(entry(), [])).toBe(false);
	});

	it('is false for an entry that is not a reroll', () => {
		expect(isRerollAgain(entry({ kind: 'redirectToSelf' }), [record()])).toBe(false);
	});

	it('is false for a Change a Die entry, which keeps its own label', () => {
		expect(isRerollAgain(entry({ use: 'change' }), [record()])).toBe(false);
	});
});

describe('rerollAgainRecords', () => {
	it('picks the records whose feature has a waiting reroll', () => {
		const sand = record();
		const ward = record({ itemUuid: 'Item.ward' });
		expect([...rerollAgainRecords([sand, ward], [entry()])]).toEqual([sand]);
	});

	it('picks only the records of the waiting rule when one feature has two rules', () => {
		const first = record();
		const second = record({ entryId: 'second-entry', ruleId: 'r2', usesLeft: 2 });
		const again = rerollAgainRecords([first, second], [entry({ ruleId: 'r2' })]);

		expect([...again]).toEqual([second]);
		expect(lines([first, second], [...again], 'Actor.bram')).toMatchObject([
			{ detail: 'Used by Wren' },
			{ detail: null },
		]);
	});
});

describe('"Reroll again" for a once-per-attack rule', () => {
	function pendingAfterReroll(oncePerAttack: boolean) {
		const used = entry({ id: 'used', used: true, oncePerAttack });
		const entries = withNewRerollEntries([used], [entry({ id: 'new', oncePerAttack })]);
		return entries.filter((candidate) => !candidate.used);
	}

	it('shows no "Reroll again" after the rule rerolled once', () => {
		const sand = record();
		const pending = pendingAfterReroll(true);

		expect(pending).toEqual([]);
		expect([...rerollAgainRecords([sand], pending)]).toEqual([]);
	});

	it('still shows "Reroll again" for a rule with once per attack off', () => {
		const sand = record();
		const pending = pendingAfterReroll(false);

		expect(pending.map((candidate) => isRerollAgain(candidate, [sand]))).toEqual([true]);
		expect([...rerollAgainRecords([sand], pending)]).toEqual([sand]);
	});
});

describe('rerollHistoryLines for a change', () => {
	const NAMES_WITH_CHANGE = { ...NAMES, 'Item.vo': 'Vicious Opportunist' };
	const changeLines = (records: RerollRecord[]) =>
		rerollHistoryLines({
			records,
			speakerUuid: 'Actor.wren',
			rerollAgain: new Set(),
			documentName: (uuid) => NAMES_WITH_CHANGE[uuid as keyof typeof NAMES_WITH_CHANGE],
		});
	const changed = (overrides: Partial<RerollRecord> = {}) =>
		record({
			itemUuid: 'Item.vo',
			use: 'change',
			change: { mode: 'set', amount: 0 },
			previous: { value: 3, outcome: null },
			next: { value: 8, outcome: 'crit' },
			...overrides,
		});

	it('says "set" on the arrow, tags a crit, and tells it as a sentence', () => {
		const [line] = changeLines([changed()]);
		expect(line).toMatchObject({
			title: 'Vicious Opportunist',
			text: 'Changed with Vicious Opportunist: 3 became 8, a crit',
			change: { arrow: 'set' },
			dice: { previous: { value: 3 }, next: { value: 8, outcome: 'crit' } },
		});
		expect(line.tags.map((tag) => [tag.kind, tag.label])).toEqual([['crit', 'Crit']]);
	});

	it('puts the number on the arrow for an add, with no tag for a plain result', () => {
		const [line] = changeLines([
			changed({
				change: { mode: 'add', amount: -1 },
				previous: { value: 4, outcome: null },
				next: { value: 3, outcome: null },
			}),
		]);
		expect(line.change).toEqual({ arrow: '-1' });
		expect(line.text).toBe('Changed with Vicious Opportunist: 4 became 3');
		expect(line.tags).toEqual([]);
		expect(changeLines([changed({ change: { mode: 'add', amount: 2 } })])[0].change).toEqual({
			arrow: '+2',
		});
	});

	it('tags a miss', () => {
		const [line] = changeLines([changed({ next: { value: 1, outcome: 'miss' } })]);
		expect(line.text).toBe('Changed with Vicious Opportunist: 3 became 1, a miss');
		expect(line.tags.map((tag) => tag.label)).toEqual(['Miss']);
	});

	it('keeps the uses left and who used it', () => {
		const [line] = changeLines([changed({ actorUuid: 'Actor.bram', usesLeft: 0 })]);
		expect(line.detail).toBe('Used by Bram - Uses left: 0');
	});
});
