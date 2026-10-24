import type { IncomingReactionEntry, RerollRecord } from '#utils/incomingReactionEntry.ts';
import { withNewRerollEntries } from '#utils/rerollEntries.ts';
import { isRerollAgain, rerollAgainRecords, rerollHistoryLines } from './rerollHistoryLines.ts';

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
				text: 'Rerolled with Pocket Sand',
				detail: 'Wounds gained: 1',
				dice: {
					previous: { faces: 8, value: 8, outcome: 'crit' },
					next: { faces: 8, value: 3, outcome: null },
				},
			},
			{
				text: 'Rerolled with Warding Bond',
				detail: 'Used by Bram - Uses left: 2',
				dice: {
					previous: { faces: 8, value: 3, outcome: null },
					next: { faces: 8, value: 1, outcome: 'miss' },
				},
			},
		]);
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

describe('"Reroll again" for a once-per-roll rule', () => {
	function pendingAfterReroll(oncePerRoll: boolean) {
		const used = entry({ id: 'used', used: true, oncePerRoll });
		const entries = withNewRerollEntries([used], [entry({ id: 'new', oncePerRoll })]);
		return entries.filter((candidate) => !candidate.used);
	}

	it('shows no "Reroll again" after the rule rerolled once', () => {
		const sand = record();
		const pending = pendingAfterReroll(true);

		expect(pending).toEqual([]);
		expect([...rerollAgainRecords([sand], pending)]).toEqual([]);
	});

	it('still shows "Reroll again" for a rule with once per roll off', () => {
		const sand = record();
		const pending = pendingAfterReroll(false);

		expect(pending.map((candidate) => isRerollAgain(candidate, [sand]))).toEqual([true]);
		expect([...rerollAgainRecords([sand], pending)]).toEqual([sand]);
	});
});
