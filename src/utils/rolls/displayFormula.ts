/**
 * A roll formula as a player reads it: roll data put in, worked-out arithmetic
 * as numbers, `X*N` as "X × N" and no `[flavor]` labels. A formula it cannot
 * read comes back with only the data put in and the labels taken out.
 */

type Token =
	| { kind: 'number'; value: number }
	| { kind: 'dice'; count: string; rest: string }
	| { kind: 'name'; value: string }
	| { kind: 'op'; value: '+' | '-' | '*' | '/' }
	| { kind: 'open' }
	| { kind: 'close' }
	| { kind: 'comma' };

/** A part of the formula: its number when it holds no dice, and its text. */
interface Shown {
	value: number | null;
	text: string;
	/** The text is a sum, so it needs parentheses inside a product. */
	sum?: boolean;
}

const DICE = /^(\d*)d(\d+|%|F)((?:[a-zA-Z]+[<>=]*\d*)*)/;
const NUMBER = /^\d+(?:\.\d+)?/;
const NAME = /^[a-zA-Z_]\w*/;

function tokenize(formula: string): Token[] | null {
	const tokens: Token[] = [];
	let rest = formula;
	while (rest.length > 0) {
		const space = /^\s+/.exec(rest);
		if (space) {
			rest = rest.slice(space[0].length);
			continue;
		}
		const dice = DICE.exec(rest);
		if (dice) {
			tokens.push({ kind: 'dice', count: dice[1], rest: `d${dice[2]}${dice[3]}` });
			rest = rest.slice(dice[0].length);
			continue;
		}
		const number = NUMBER.exec(rest);
		if (number) {
			tokens.push({ kind: 'number', value: Number(number[0]) });
			rest = rest.slice(number[0].length);
			continue;
		}
		const name = NAME.exec(rest);
		if (name) {
			tokens.push({ kind: 'name', value: name[0] });
			rest = rest.slice(name[0].length);
			continue;
		}
		const char = rest[0];
		if (char === '+' || char === '-' || char === '*' || char === '/') {
			tokens.push({ kind: 'op', value: char });
		} else if (char === '(') tokens.push({ kind: 'open' });
		else if (char === ')') tokens.push({ kind: 'close' });
		else if (char === ',') tokens.push({ kind: 'comma' });
		else return null;
		rest = rest.slice(1);
	}
	return tokens;
}

function numberText(value: number): string {
	return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function shownNumber(value: number): Shown {
	return { value, text: numberText(value) };
}

const MATH_FUNCTIONS = new Set(['floor', 'ceil', 'round', 'abs', 'min', 'max', 'trunc', 'sign']);

class Parser {
	#tokens: Token[];
	#at = 0;

	constructor(tokens: Token[]) {
		this.#tokens = tokens;
	}

	parse(): Shown | null {
		const shown = this.#sum();
		return shown && this.#at === this.#tokens.length ? shown : null;
	}

	#peek(): Token | undefined {
		return this.#tokens[this.#at];
	}

	#sum(): Shown | null {
		let left = this.#product();
		while (left) {
			const next = this.#peek();
			if (next?.kind !== 'op' || (next.value !== '+' && next.value !== '-')) break;
			this.#at += 1;
			const right = this.#product();
			if (!right) return null;
			if (left.value !== null && right.value !== null) {
				left = shownNumber(
					next.value === '+' ? left.value + right.value : left.value - right.value,
				);
				continue;
			}
			// "+ -2" reads as "- 2".
			const negative = right.text.startsWith('-');
			const operator = negative ? (next.value === '+' ? '-' : '+') : next.value;
			const rightText = negative ? right.text.slice(1) : right.text;
			left = { value: null, text: `${left.text} ${operator} ${rightText}`, sum: true };
		}
		return left;
	}

	#product(): Shown | null {
		let left = this.#unary();
		while (left) {
			const next = this.#peek();
			if (next?.kind !== 'op' || (next.value !== '*' && next.value !== '/')) break;
			this.#at += 1;
			const right = this.#unary();
			if (!right) return null;
			if (left.value !== null && right.value !== null) {
				left = shownNumber(
					next.value === '*' ? left.value * right.value : left.value / right.value,
				);
				continue;
			}
			const sign = next.value === '*' ? '×' : '÷';
			const wrap = (part: Shown) => (part.sum ? `(${part.text})` : part.text);
			left = { value: null, text: `${wrap(left)} ${sign} ${wrap(right)}` };
		}
		return left;
	}

	#unary(): Shown | null {
		const next = this.#peek();
		if (next?.kind === 'op' && (next.value === '-' || next.value === '+')) {
			this.#at += 1;
			const inner = this.#unary();
			if (!inner) return null;
			if (next.value === '+') return inner;
			if (inner.value !== null) return shownNumber(-inner.value);
			return { value: null, text: `-${inner.sum ? `(${inner.text})` : inner.text}` };
		}
		return this.#primary();
	}

	#primary(): Shown | null {
		const token = this.#peek();
		if (!token) return null;
		this.#at += 1;
		if (token.kind === 'number') return shownNumber(token.value);
		if (token.kind === 'dice') return { value: null, text: `${token.count || '1'}${token.rest}` };
		if (token.kind === 'open') {
			const inner = this.#sum();
			if (!inner || this.#peek()?.kind !== 'close') return null;
			this.#at += 1;
			return this.#withDiceCount(inner);
		}
		if (token.kind === 'name' && MATH_FUNCTIONS.has(token.value)) {
			if (this.#peek()?.kind !== 'open') return null;
			this.#at += 1;
			const args: Shown[] = [];
			while (this.#peek()?.kind !== 'close') {
				const arg = this.#sum();
				if (!arg) return null;
				args.push(arg);
				if (this.#peek()?.kind === 'comma') this.#at += 1;
				else if (this.#peek()?.kind !== 'close') return null;
			}
			this.#at += 1;
			const shown = this.#call(token.value, args);
			return shown && this.#withDiceCount(shown);
		}
		return null;
	}

	#call(name: string, args: Shown[]): Shown | null {
		const values = args.map((arg) => arg.value);
		if (values.every((value): value is number => value !== null) && values.length > 0) {
			const fn = Math[name as 'floor'] as (...numbers: number[]) => number;
			return shownNumber(fn(...values));
		}
		return { value: null, text: `${name}(${args.map((arg) => arg.text).join(', ')})` };
	}

	/** `(2 + 1)d12` reads as "3d12". A group with dice keeps its parentheses only in a product. */
	#withDiceCount(inner: Shown): Shown | null {
		const next = this.#peek();
		if (next?.kind === 'dice' && next.count === '') {
			if (inner.value === null) return null;
			this.#at += 1;
			return { value: null, text: `${numberText(inner.value)}${next.rest}` };
		}
		return inner;
	}
}

function withRollData(formula: string, rollData: Record<string, unknown> | null | undefined) {
	if (!rollData) return formula;
	return formula.replace(/@([a-z.0-9_-]+)/gi, (_match, path: string) => {
		let value: unknown = rollData;
		for (const key of path.split('.')) {
			value = (value as Record<string, unknown> | null | undefined)?.[key];
		}
		return typeof value === 'number' || typeof value === 'string' ? String(value) : '0';
	});
}

export function displayFormula(
	formula: string | null | undefined,
	rollData?: Record<string, unknown> | null,
): string {
	const plain = withRollData(String(formula ?? ''), rollData)
		.replace(/\[[^\]]*\]/g, '')
		.trim();
	if (!plain) return '';
	const tokens = tokenize(plain);
	const shown = tokens && tokens.length > 0 ? new Parser(tokens).parse() : null;
	return shown ? shown.text : plain.replace(/\s+/g, ' ');
}
