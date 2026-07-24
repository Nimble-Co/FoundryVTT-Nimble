import { isPlainObject } from '../utils/isPlainObject.js';

const BINARY_PROPS = new Set(['equal', 'max', 'min']);
const LOGICAL_KEYS = new Set(['$and', '$or']);

class Predicate extends Map<string, Statement> {
	readonly isValid: boolean;

	readonly _source: RawPredicate;

	constructor(data: RawPredicate) {
		super(Object.entries(data));
		this._source = data;
		this.isValid = Predicate.isValid([...this.entries()]);
	}

	static isValid(entries: unknown): boolean {
		if (!Array.isArray(entries)) return false;
		return entries.every(([key, val]) => {
			if (typeof key !== 'string') return false;
			if (Predicate.isLogicalKey(key)) return Predicate.isLogicalValue(val);
			return Predicate.isStatement(val);
		});
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

		// Top-level logical operators: $and / $or compose array elements recursively.
		// Each element is either an atom string (presence-checked against the domain)
		// or a plain-object sub-predicate (evaluated via #testRaw).
		if (key === '$and') {
			if (!Array.isArray(val)) return false;
			return (val as LogicalArrayItem[]).every((item) => this.#testLogicalItem(item, domain));
		}
		if (key === '$or') {
			if (!Array.isArray(val)) return false;
			return (val as LogicalArrayItem[]).some((item) => this.#testLogicalItem(item, domain));
		}

		return (
			(typeof val === 'string' && domain.has(`${key}:${val}`)) ||
			(Predicate.isBinaryOperation(val) && this.#testBinaryOperation(key, val, domain)) ||
			(Predicate.isArrayOperation(val) && this.#testArrayOperation(key, val, domain)) ||
			false // TODO: Implement Complex Operation
		);
	}

	#testLogicalItem(item: LogicalArrayItem, domain: Set<string>): boolean {
		if (typeof item === 'string') return domain.has(item);
		return this.#testRaw(item, domain);
	}

	/**
	 * Evaluate a raw predicate object against the domain. Used by $and / $or to
	 * recurse into sub-predicates without constructing a full Predicate instance
	 * (avoids the Map allocation per attack-time evaluation). An empty sub-predicate
	 * is vacuously true, matching the top-level test() behavior.
	 */
	#testRaw(raw: RawPredicate, domain: Set<string>): boolean {
		const entries = Object.entries(raw);
		if (entries.length === 0) return true;
		return entries.every((s) => this.#isTrue(s as PredicateStatement, domain));
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
		return [...this.entries()].every((s) => this.#isTrue(s as PredicateStatement, domain));
	}

	toObject(): RawPredicate {
		return foundry.utils.deepClone(this._source);
	}

	clone(): Predicate {
		return new Predicate(this.toObject());
	}

	/**
	 * Collect every tag key a raw predicate references: top-level leaf keys plus,
	 * inside $and/$or arrays, atom prefixes (text before the first ':') and keys
	 * from nested sub-predicates. Atoms without a colon yield themselves.
	 */
	static extractReferencedKeys(raw: RawPredicate): Set<string> {
		const keys = new Set<string>();
		if (!isPlainObject(raw)) return keys;

		for (const [key, value] of Object.entries(raw)) {
			if (Predicate.isLogicalKey(key)) {
				if (!Array.isArray(value)) continue;

				for (const item of value as LogicalArrayItem[]) {
					if (typeof item === 'string') {
						const atomKey = item.split(':', 1)[0];
						if (atomKey) keys.add(atomKey);
					} else if (isPlainObject(item)) {
						for (const nested of Predicate.extractReferencedKeys(item)) keys.add(nested);
					}
				}
			} else {
				keys.add(key);
			}
		}

		return keys;
	}

	/** ---------------------------------------------- */
	/** Validators                                     */
	/** ---------------------------------------------- */
	static isLogicalKey(key: string): key is '$and' | '$or' {
		return LOGICAL_KEYS.has(key);
	}

	/**
	 * A logical operator value must be an array. Each element is either:
	 *   - a non-empty atom string (presence-checked against the full tag), or
	 *   - a non-empty plain-object sub-predicate (recursively validated).
	 * Empty sub-predicates `{}` are rejected to avoid silent always-true bonuses
	 * (e.g. `{ "$or": [{}] }` would otherwise vacuously pass). Empty arrays at
	 * the operator level are still allowed: `$and: []` is vacuously true,
	 * `$or: []` is vacuously false — mathematically consistent if rarely used.
	 */
	static isLogicalValue(value: unknown): value is LogicalArrayItem[] {
		if (!Array.isArray(value)) return false;
		return value.every((item) => {
			if (typeof item === 'string') return item.length > 0;
			if (isPlainObject(item)) {
				const entries = Object.entries(item);
				if (entries.length === 0) return false;
				return Predicate.isValid(entries);
			}
			return false;
		});
	}

	static isStatement(statement: unknown): boolean {
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

type LogicalArrayItem = string | RawPredicate;
type LogicalArray = LogicalArrayItem[];

type Statement = AtomicOperation | BinaryOperation | ArrayOperation | LogicalArray;

type PredicateStatement = [string, Statement];
type RawPredicate = Record<string, Statement>;

export { Predicate, type RawPredicate };
