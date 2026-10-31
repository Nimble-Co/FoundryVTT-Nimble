import { describe, expect, it } from 'vitest';
import { attackOutcomeTags, primaryDieBonusNotAdded } from '../attackOutcomeTags.js';

function roll(face: number, overrides: Record<string, unknown> = {}, options = {}) {
	return {
		isCritical: false,
		isMiss: false,
		options,
		terms: [{ faces: 6, results: [{ result: face, active: true }] }],
		...overrides,
	};
}

const labels = (...args: Parameters<typeof attackOutcomeTags>) =>
	attackOutcomeTags(...args).map((tag) => tag.label);

describe('attackOutcomeTags', () => {
	it('gives no tag to a roll with no causes', () => {
		expect(attackOutcomeTags(roll(4), 1)).toEqual([]);
		expect(attackOutcomeTags(null, 1)).toEqual([]);
	});

	describe('crit causes', () => {
		const sources = (forcedCrit: string[]) => ({ outcomeSources: { forcedCrit } });

		it('names each Forced Crit source when the die is below its max', () => {
			const tags = attackOutcomeTags(
				roll(3, { isCritical: true }, sources(['Touch', 'target Stunned'])),
				1,
			);
			expect(tags.map((tag) => tag.label)).toEqual(['Crit: Touch', 'Crit: target Stunned']);
			expect(tags[0]?.kind).toBe('crit');
			expect(tags[0]?.tooltip).toContain('3');
			expect(tags[0]?.tooltip).toContain('Touch');
		});

		it('gives no tag when the die rolled its max: the max is the cause', () => {
			expect(labels(roll(6, { isCritical: true }, sources(['Touch'])), 1)).toEqual([]);
		});

		it('gives no tag when the roll is not a crit', () => {
			expect(labels(roll(1, { isMiss: true }, sources(['target Stunned'])), 1)).toEqual([]);
		});

		it('names a crit range source only when the face is in its range', () => {
			const options = {
				critRange: 1,
				forcedCrit: 'onHit',
				outcomeSources: { critRange: ['Heads I Win'], forcedCrit: ['target Stunned'] },
			};
			expect(labels(roll(5, { isCritical: true }, options), 1)).toEqual([
				'Crit: target Stunned',
				'Crit: Heads I Win',
			]);
			expect(labels(roll(3, { isCritical: true }, options), 1)).toEqual(['Crit: target Stunned']);
		});

		it('names an any-die source only when another die is at its max', () => {
			const options = { outcomeSources: { anyDieCrits: ['Shatter'] } };
			const dice = [
				{ faces: 6, results: [{ result: 3, active: true }] },
				{ faces: 8, results: [{ result: 8, active: true }] },
			];
			expect(labels(roll(3, { isCritical: true, terms: dice }, options), 1)).toEqual([
				'Crit: Shatter',
			]);
			expect(labels(roll(3, { isCritical: true }, options), 1)).toEqual([]);
		});

		it('reads the kept face, not a dropped one', () => {
			const terms = [
				{
					faces: 6,
					results: [
						{ result: 6, active: false, discarded: true },
						{ result: 2, active: true },
					],
				},
			];
			expect(labels(roll(0, { isCritical: true, terms }, sources(['Touch'])), 1)).toEqual([
				'Crit: Touch',
			]);
		});
	});

	describe('cannot miss', () => {
		const options = { canMiss: false, outcomeSources: { cannotMiss: ['Slashing'] } };

		it('names the feature when a 1 was read as a hit', () => {
			const tags = attackOutcomeTags(roll(1, {}, options), 1);
			expect(tags.map((tag) => tag.label)).toEqual(['Cannot miss: Slashing']);
			expect(tags[0]?.kind).toBe('cannotMiss');
		});

		it('reads a raised miss threshold', () => {
			expect(labels(roll(2, {}, { ...options, missThreshold: 2 }), 1)).toEqual([
				'Cannot miss: Slashing',
			]);
		});

		it('gives no tag on a face that would hit anyway', () => {
			expect(labels(roll(2, {}, options), 1)).toEqual([]);
		});

		it('gives no tag on a forced miss', () => {
			expect(labels(roll(1, { isMiss: true }, options), 1)).toEqual([]);
		});
	});

	describe('a Multi-target Attack', () => {
		const options = { multiTarget: true, canCrit: false, canMiss: false };

		it('tells "No miss" on a 1, with the count of targets, and names Core:1403', () => {
			const tags = attackOutcomeTags(roll(1, {}, options), 3);
			expect(tags.map((tag) => tag.label)).toEqual(['No miss: 3 targets']);
			expect(tags[0]?.kind).toBe('noOutcome');
			expect(tags[0]?.tooltip).toContain('Core:1403');
		});

		it('tells "No crit" on the max', () => {
			expect(labels(roll(6, {}, options), 2)).toEqual(['No crit: 2 targets']);
		});

		it('tells nothing on another roll', () => {
			expect(labels(roll(4, {}, options), 2)).toEqual([]);
		});
	});
});

describe('primaryDieBonusNotAdded', () => {
	const documentName = (uuid: string) => (uuid === 'Item.judge' ? 'Judgment' : null);
	const setRecord = {
		use: 'change',
		itemUuid: 'Item.judge',
		label: 'Old name',
		change: { mode: 'set', value: 0 },
		next: { value: 8, outcome: 'crit' },
	};

	it('tells who set the die, and to what', () => {
		const text = primaryDieBonusNotAdded({ primaryDieBonusOff: true }, [setRecord], documentName);
		expect(text).toContain('Judgment');
		expect(text).toContain('8');
	});

	it('is null while the bonus is on the die', () => {
		expect(primaryDieBonusNotAdded({}, [setRecord], documentName)).toBeNull();
		expect(primaryDieBonusNotAdded(undefined, [setRecord], documentName)).toBeNull();
	});

	it('still explains when the card has no record of the set', () => {
		expect(primaryDieBonusNotAdded({ primaryDieBonusOff: true }, [], documentName)).toBeTruthy();
	});
});
