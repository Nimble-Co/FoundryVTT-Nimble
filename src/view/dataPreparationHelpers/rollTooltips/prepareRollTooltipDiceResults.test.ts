import prepareRollTooltipDiceResults from './prepareRollTooltipDiceResults.js';

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
