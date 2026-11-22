import prepareRollTooltipFormula from '../prepareRollTooltipFormula.js';

function shown(terms: object[]) {
	const root = document.createElement('div');
	root.innerHTML = prepareRollTooltipFormula({ terms });
	return [...root.querySelectorAll('.nimble-roll-formula__term')].map((span) => span.textContent);
}

const operator = (value: string) => ({ expression: ` ${value} `, operator: value });

describe('prepareRollTooltipFormula', () => {
	it('works out a run of terms with no dice', () => {
		expect(
			shown([{ expression: '(2 + floor(1 / 5))', dice: [] }, operator('*'), { expression: '2' }]),
		).toEqual(['4']);
	});

	it('keeps each term of a run with dice, and the flavor of each term', () => {
		expect(
			shown([
				{
					expression: '1d12x',
					faces: 12,
					number: 1,
					denomination: 'd',
					modifiers: ['x'],
					flavor: 'Primary Die',
				},
				operator('+'),
				{ expression: '3', flavor: 'Juggernaut' },
			]),
		).toEqual(['1d12x [Primary Die]', ' + ', '3 [Juggernaut]']);
	});
});
