import prepareRollTooltipRollParts from '../prepareRollTooltipParts.js';

type Result = {
	result: number;
	active?: boolean;
	discarded?: boolean;
	exploded?: boolean;
	provenance?: string;
};

const die = (result: number, extra: Partial<Result> = {}): Result => ({
	result,
	active: true,
	...extra,
});
const chain = (result: number, extra: Partial<Result> = {}) =>
	die(result, { provenance: 'viciousChain', ...extra });
const vicious = (result: number) => die(result, { provenance: 'viciousBonus' });

function term(expression: string, faces: number, results: Result[], flavor = 'Primary Die') {
	return {
		expression,
		faces,
		flavor,
		options: {},
		results,
		total: results.reduce(
			(sum, r) => (r.active !== false && !r.discarded ? sum + r.result : sum),
			0,
		),
	};
}

function sections(html: string) {
	const root = document.createElement('div');
	root.innerHTML = html;
	return [...root.querySelectorAll('section.nimble-roll-details')].map((section) => ({
		header: section
			.querySelector('.nimble-roll-details__formula')
			?.textContent?.replace(/\s+/g, ' ')
			.trim(),
		total: Number(section.querySelector('.nimble-roll-details__total')?.textContent),
		dice: [...section.querySelectorAll('li')].map((li) => ({
			result: Number(li.textContent),
			max: li.classList.contains('nimble-die--max'),
			min: li.classList.contains('nimble-die--min'),
		})),
	}));
}

const tooltip = (...dice: ReturnType<typeof term>[]) =>
	sections(prepareRollTooltipRollParts({ dice, options: {} }));

describe('prepareRollTooltipRollParts with Vicious dice', () => {
	it('puts the Vicious die of a crit that explodes once on its own line after the Primary Die', () => {
		const [primary, viciousLine, ...rest] = tooltip(
			term('1d4', 4, [die(4, { exploded: true }), chain(2), vicious(3)]),
		);

		expect(rest).toHaveLength(0);
		expect(primary.header).toBe('1d4 [Primary Die]');
		expect(primary.dice.map((d) => d.result)).toEqual([4, 2]);
		expect(viciousLine.header).toBe('1d4 [Vicious]');
		expect(viciousLine.dice.map((d) => d.result)).toEqual([3]);
	});

	it('names 2 Vicious dice after a crit that explodes twice', () => {
		const [primary, viciousLine] = tooltip(
			term('1d4', 4, [
				die(4, { exploded: true }),
				chain(4, { exploded: true }),
				vicious(3),
				chain(1),
				vicious(2),
			]),
		);

		expect(primary.dice.map((d) => d.result)).toEqual([4, 4, 1]);
		expect(viciousLine.header).toBe('2d4 [Vicious]');
		expect(viciousLine.dice.map((d) => d.result)).toEqual([3, 2]);
	});

	it('splits the old Primary Die total between the two lines', () => {
		const part = term('1d4', 4, [
			die(4, { exploded: true }),
			chain(4, { exploded: true }),
			vicious(3),
			chain(1),
			vicious(2),
		]);
		const [primary, viciousLine] = tooltip(part);

		expect(primary.total).toBe(9);
		expect(viciousLine.total).toBe(5);
		expect(primary.total + viciousLine.total).toBe(part.total);
	});

	it('gives a Vicious die at its max no crit mark, and keeps the crit mark of the Primary Die', () => {
		const [primary, viciousLine] = tooltip(
			term('1d4', 4, [die(4, { exploded: true }), chain(1), vicious(4)]),
		);

		expect(viciousLine.dice).toEqual([{ result: 4, max: false, min: false }]);
		expect(primary.dice).toEqual([
			{ result: 4, max: true, min: false },
			{ result: 1, max: false, min: false },
		]);
	});

	// Only the first face of the Primary Die decides a miss; an exploded die only adds damage.
	it('gives a 1 on an exploded die no miss mark', () => {
		const [primary] = tooltip(term('1d6', 6, [die(6, { exploded: true }), chain(1)]));

		expect(primary.dice.map((d) => d.min)).toEqual([false, false]);
	});

	it('gives a per-die Vicious term one Vicious line with all its Vicious dice', () => {
		const lines = tooltip(
			term('4d4cv', 4, [
				die(4, { exploded: true }),
				die(2),
				die(4, { exploded: true }),
				die(1),
				chain(2),
				vicious(4),
				chain(3),
				vicious(1),
			]),
		);

		expect(lines).toHaveLength(2);
		expect(lines[0].dice.map((d) => d.result)).toEqual([4, 2, 4, 1, 2, 3]);
		expect(lines[0].total).toBe(16);
		expect(lines[1].header).toBe('2d4 [Vicious]');
		expect(lines[1].total).toBe(5);
		expect(lines[1].dice.map((d) => d.result)).toEqual([4, 1]);
		expect(lines[1].dice.some((d) => d.max)).toBe(false);
	});

	it('puts each Vicious line after its own term', () => {
		const lines = tooltip(
			term('1d6', 6, [die(6, { exploded: true }), chain(1), vicious(5)]),
			term('1d4', 4, [die(4, { exploded: true }), chain(3), vicious(2)], ''),
		);

		expect(lines.map((line) => line.header)).toEqual([
			'1d6 [Primary Die]',
			'1d6 [Vicious]',
			'1d4',
			'1d4 [Vicious]',
		]);
	});

	it('gives a roll with no Vicious dice the same tooltip as before', () => {
		const html = prepareRollTooltipRollParts({
			dice: [term('1d6', 6, [die(6, { exploded: true }), die(6, { exploded: true }), die(3)])],
			options: {},
		});

		expect(html).toBe(`<section class="nimble-roll-details">
          <header class="nimble-roll-details__header">
              <div class="nimble-roll-details__formula">
                  1d6
                  <span class="nimble-roll-details__flavor"> [Primary Die]</span></div>
              <span class="nimble-roll-details__total">15</span>
          </header>

      <ol class="nimble-roll-details__dice-list"><li class="nimble-die nimble-die--6 nimble-die--max">6</li><li class="nimble-die nimble-die--6 nimble-die--max">6</li><li class="nimble-die nimble-die--6">3</li></ol></section>`);
	});
});
