import { isPlainObject } from '../utils/isPlainObject.js';

const BINARY_PROPS = new Set(['equal', 'max', 'min']);

class Predicate extends Map<string, Statement> {
	readonly isValid: boolean;

	readonly _source: RawPredicate;

	constructor(data: RawPredicate) {
		super(Object.entries(data));
		this._source = data;
		this.isValid = Predicate.isValid([...this.entries()]);
	}

	static isValid(statements: unknown): statements is PredicateStatement {
		return Array.isArray(statements) && statements.every((s) => Predicate.isStatement(s[1]));
	}

	/** ---------------------------------------------- */
	/** Test Methods                                   */
	/** ---------------------------------------------- */
	#getConfigValue(predicateKey: string, propertyKey: string) {
		const { PREDICATE_KEY_CONFIG_MAPPING } = CONFIG.NIMBLE;

		const data: Record<string, number> | undefined = PREDICATE_KEY_CONFIG_MAPPING[predicateKey];
		return data?.[propertyKey] ?? Number.NaN;
	}

	#getNumValues(key: string | number, type: 'number' | 'string', domain: Set<string>) {
		if (type === 'number') {
			const maybeNumber = Number(key);
			if (!Number.isNaN(maybeNumber)) return [maybeNumber];
		}

		const domainArray = Array.from(domain);
		const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const pattern = new RegExp(`^${escapedKey}:([^:]+)$`);

		const values = domainArray.reduce((acc, s) => {
			const value = pattern.exec(s)?.[1];
			if (value === undefined) return acc;

			if (type === 'number') acc.push(Number(value));
			else {
				acc.push(this.#getConfigValue(key as string, value));
			}

			return acc;
		}, [] as number[]);

		return values.length > 0 ? values : [Number.NaN];
	}

	#getDomainValues(key: string, domain: Set<string>) {
		const domainArray = Array.from(domain);
		const escapedKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const pattern = new RegExp(`^${escapedKey}:([^:]+)$`);

		const values = domainArray.reduce((acc, s) => {
			const value = pattern.exec(s)?.[1];
			if (value === undefined) return acc;
			const maybeNumber = Number(value);

			acc.add(Number.isNaN(maybeNumber) ? value : maybeNumber);
			return acc;
		}, new Set<string | number>());

		return values;
	}

	#isTrue(statement: PredicateStatement, domain: Set<string>): boolean {
		const [key, val] = statement;

		return (
			(typeof val === 'string' && domain.has(`${key}:${val}`)) ||
			(Predicate.isBinaryOperation(val) && this.#testBinaryOperation(key, val, domain)) ||
			(Predicate.isArrayOperation(val) && this.#testArrayOperation(key, val, domain)) ||
			false // TODO: Implement Complex Operation
		);
	}

	/**
	 * Check if the predicate values in the form of an array exist in the domain.
	 * This is an or operation
	 */
	#testArrayOperation(key: string, statement: ArrayOperation, domain: Set<string>) {
		const domainOptions = this.#getDomainValues(key, domain);
		const statementOptions = new Set<string | number>(statement);

		return domainOptions.intersects(statementOptions);
	}

	/**
	 * Check if the predicate of min, max, equal exists in the domain.
	 */
	#testBinaryOperation(key: string, statement: BinaryOperation, domain: Set<string>): boolean {
		// Check equality
		if (statement.equal !== null && statement.equal !== undefined) {
			return domain.has(`${key}:${statement.equal}`);
		}

		const domainNumValues = this.#getNumValues(key, 'number', domain);
		const domainStringValues = this.#getNumValues(key, 'string', domain);

		// Check min
		if (statement.min !== null && statement.min !== undefined) {
			const { min } = statement;
			if (typeof min === 'number') {
				if (domainNumValues.some((v) => v < min)) return false;
			} else {
				const minAsNumber = this.#getConfigValue(key, min);
				if (domainStringValues.some((v) => v < minAsNumber)) return false;
			}
		}

		// Check max
		if (statement.max !== null && statement.max !== undefined) {
			const { max } = statement;
			if (typeof max === 'number') {
				if (domainNumValues.some((v) => v > max)) return false;
			} else {
				const maxAsNumber = this.#getConfigValue(key, max);
				if (domainStringValues.some((v) => v > maxAsNumber)) return false;
			}
		}

		return true;
	}

	/** ---------------------------------------------- */
	/** Public Methods                                 */
	/** ---------------------------------------------- */
	test(options: Set<string> | string[]): boolean {
		if (!this.size) return true;

		if (!this.isValid) {
			// eslint-disable-next-line no-console
			console.warn('Nimble | The provided predicate set is malformed.');
			return false;
		}

		const domain = options instanceof Set ? options : new Set(options);
		return [...this.entries()].every((s) => this.#isTrue(s, domain));
	}

	toObject(): RawPredicate {
		return foundry.utils.deepClone(this._source);
	}

	clone(): Predicate {
		return new Predicate(this.toObject());
	}

	/** ---------------------------------------------- */
	/** Validators                                     */
	/** ---------------------------------------------- */
	static isStatement(statement: unknown): statement is PredicateStatement {
		if (isPlainObject(statement)) return Predicate.isBinaryOperation(statement);
		if (Array.isArray(statement)) return Predicate.isArrayOperation(statement);
		if (typeof statement === 'string') return Predicate.isAtomicOperation(statement);

		return false;
	}

	static isAtomicOperation(statement: unknown): statement is AtomicOperation {
		return typeof statement === 'string' && statement.length > 0;
	}

	static isBinaryOperation(statement: unknown): statement is BinaryOperation {
		if (!isPlainObject(statement)) return false;

		const keys = Object.keys(statement);
		const values = Object.values(statement);

		if (keys.length === 0) return false;
		if (keys.includes('equal') && keys.length > 1) return false;

		if (new Set(keys).intersection(BINARY_PROPS).size === 0) return false;

		return values.every((v) => ['string', 'number'].includes(typeof v));
	}

	static isArrayOperation(statement: unknown): statement is ArrayOperation {
		return (
			Array.isArray(statement) &&
			statement.length > 0 &&
			statement.every((s) => ['string', 'number'].includes(typeof s))
		);
	}
}

type AtomicOperation = string;
type ArrayOperation = string[] | number[];

type BinaryOperation = {
	min?: number | string;
	max?: number | string;
	equal?: number | string;
};

type Statement = AtomicOperation | BinaryOperation | ArrayOperation;

type PredicateStatement = [string, Statement];
type RawPredicate = Record<string, Statement>;

export { Predicate, type RawPredicate };
