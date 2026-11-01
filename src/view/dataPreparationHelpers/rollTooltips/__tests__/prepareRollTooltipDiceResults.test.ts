import { PrimaryDie } from '../../../../dice/terms/PrimaryDie.js';
import prepareRollTooltipDiceResults from '../prepareRollTooltipDiceResults.js';

describe('prepareRollTooltipDiceResults', () => {
	it('marks every primary-die result at or below the configured miss threshold', () => {
		const html = prepareRollTooltipDiceResults({
			faces: 8,
			flavor: 'Primary Die',
			options: { missThreshold: 2 },
			results: [
				{ result: 1, active: true },
				{ result: 2, active: true },
				{ result: 3, active: true },
			],
		});

		expect(html).toContain('nimble-die--min">1</li>');
		expect(html).toContain('nimble-die--min">2</li>');
		expect(html).not.toContain('nimble-die--min">3</li>');
	});

	it('keeps a maximum-face result styled as a critical hit', () => {
		const html = prepareRollTooltipDiceResults({
			faces: 2,
			flavor: 'Primary Die',
			options: { missThreshold: 2 },
			results: [{ result: 2, active: true }],
		});

		expect(html).toContain('nimble-die--max">2</li>');
		expect(html).not.toContain('nimble-die--min');
	});
});

describe('prepareRollTooltipDiceResults with the crit face of the roll', () => {
	const primary = (options: object, ...faces: number[]) => ({
		faces: 6,
		flavor: 'Primary Die',
		options,
		results: faces.map((result) => ({ result, active: true })),
	});

	it('gives a face in the crit range the crit look', () => {
		const html = prepareRollTooltipDiceResults(primary({ critRange: 1 }, 5));
		expect(html).toContain('nimble-die--max">5</li>');
	});

	it('gives a kept face the crit look under a Forced Crit, and a 1 only when it always applies', () => {
		expect(prepareRollTooltipDiceResults(primary({ forcedCrit: 'onHit' }, 3))).toContain(
			'nimble-die--max">3</li>',
		);
		expect(prepareRollTooltipDiceResults(primary({ forcedCrit: 'onHit' }, 1))).toContain(
			'nimble-die--min">1</li>',
		);
		expect(prepareRollTooltipDiceResults(primary({ forcedCrit: 'always' }, 1))).toContain(
			'nimble-die--max">1</li>',
		);
	});

	it('gives a crit die only the look of its max: it is not the kept face', () => {
		const html = prepareRollTooltipDiceResults(primary({ critRange: 1 }, 5, 5));
		expect(html).toContain('nimble-die--max">5</li>');
		expect(html).toContain('<li class="nimble-die nimble-die--6">5</li>');
	});

	it('gives no miss look on a roll that cannot miss, and no crit look on one that cannot crit', () => {
		const rollOptions = { canMiss: false, canCrit: false };
		expect(prepareRollTooltipDiceResults(primary({}, 1), rollOptions)).not.toContain(
			'nimble-die--min',
		);
		expect(prepareRollTooltipDiceResults(primary({}, 6), rollOptions)).not.toContain(
			'nimble-die--max',
		);
	});

	it('gives an "always" crit its look on a roll that cannot miss', () => {
		expect(
			prepareRollTooltipDiceResults(primary({ forcedCrit: 'always' }, 1), { canMiss: false }),
		).toContain('nimble-die--max">1</li>');
	});
});

describe('prepareRollTooltipDiceResults with a stored Primary Die', () => {
	it('knows the term by its class: only an extracted die has the flavor', () => {
		const term = new PrimaryDie({ number: 1, faces: 8, options: { forcedCrit: 'onHit' } });
		term.results = [{ result: 3, active: true }];
		expect(prepareRollTooltipDiceResults(term)).toContain('nimble-die--max">3</li>');
	});
});
