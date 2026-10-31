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
		expect(attackOutcomeTags(roll(4))).toEqual([]);
		expect(attackOutcomeTags(null)).toEqual([]);
	});

	describe('crit causes', () => {
		const sources = (forcedCrit: string[]) => ({ outcomeSources: { forcedCrit } });

		it('names each Forced Crit source when the die is below its max', () => {
			const tags = attackOutcomeTags(
				roll(3, { isCritical: true }, sources(['Touch', 'target Stunned'])),
			);
			expect(tags.map((tag) => tag.label)).toEqual(['Crit: Touch', 'Crit: target Stunned']);
			expect(tags[0]?.kind).toBe('crit');
			expect(tags[0]?.tooltip).toContain('3');
			expect(tags[0]?.tooltip).toContain('Touch');
		});

		it('gives no tag when the die rolled its max: the max is the cause', () => {
			expect(labels(roll(6, { isCritical: true }, sources(['Touch'])))).toEqual([]);
		});

		it('gives no tag when the roll is not a crit', () => {
			expect(labels(roll(1, { isMiss: true }, sources(['target Stunned'])))).toEqual([]);
		});

		it('names a crit range source only when the face is in its range', () => {
			const options = {
				critRange: 1,
				forcedCrit: 'onHit',
				outcomeSources: { critRange: ['Heads I Win'], forcedCrit: ['target Stunned'] },
			};
			expect(labels(roll(5, { isCritical: true }, options))).toEqual([
				'Crit: target Stunned',
				'Crit: Heads I Win',
			]);
			expect(labels(roll(3, { isCritical: true }, options))).toEqual(['Crit: target Stunned']);
		});

		it('names an any-die source only when another die is at its max', () => {
			const options = { outcomeSources: { anyDieCrits: ['Shatter'] } };
			const dice = [
				{ faces: 6, results: [{ result: 3, active: true }] },
				{ faces: 8, results: [{ result: 8, active: true }] },
			];
			expect(labels(roll(3, { isCritical: true, terms: dice }, options))).toEqual([
				'Crit: Shatter',
			]);
			expect(labels(roll(3, { isCritical: true }, options))).toEqual([]);
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
			expect(labels(roll(0, { isCritical: true, terms }, sources(['Touch'])))).toEqual([
				'Crit: Touch',
			]);
		});
	});

	describe('cannot miss', () => {
		const options = { canMiss: false, outcomeSources: { cannotMiss: ['Slashing'] } };

		it('names the feature when a 1 was read as a hit', () => {
			const tags = attackOutcomeTags(roll(1, {}, options));
			expect(tags.map((tag) => tag.label)).toEqual(['Cannot miss: Slashing']);
			expect(tags[0]?.kind).toBe('cannotMiss');
		});

		it('reads a raised miss threshold', () => {
			expect(labels(roll(2, {}, { ...options, missThreshold: 2 }))).toEqual([
				'Cannot miss: Slashing',
			]);
		});

		it('gives no tag on a face that would hit anyway', () => {
			expect(labels(roll(2, {}, options))).toEqual([]);
		});

		it('gives no tag on a forced miss', () => {
			expect(labels(roll(1, { isMiss: true }, options))).toEqual([]);
		});
	});

	describe('a Multi-target Attack', () => {
		const options = { multiTarget: true, canCrit: false, canMiss: false };

		const detail = (more = {}) => ({
			multiTargetDetail: { targets: 3, couldCrit: true, couldMiss: true, ...more },
		});

		it('tells "No miss" on a 1, with the count of targets when rolled', () => {
			const tags = attackOutcomeTags(roll(1, {}, { ...options, ...detail() }));
			expect(tags.map((tag) => tag.label)).toEqual(['No miss: 3 targets']);
			expect(tags[0]?.kind).toBe('noOutcome');
			expect(tags[0]?.tooltip).toContain('3 targets');
		});

		it('tells "No crit" on the max', () => {
			expect(labels(roll(6, {}, options))).toEqual(['No crit: 2 targets']);
		});

		it('tells nothing when the attack could not crit or miss with 1 target', () => {
			expect(labels(roll(6, {}, { ...options, ...detail({ couldCrit: false }) }))).toEqual([]);
			expect(labels(roll(1, {}, { ...options, ...detail({ couldMiss: false }) }))).toEqual([]);
		});

		it('tells nothing on another roll', () => {
			expect(labels(roll(4, {}, options))).toEqual([]);
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
