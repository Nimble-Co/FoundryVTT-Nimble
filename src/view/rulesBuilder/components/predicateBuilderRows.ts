import type { RawPredicate } from '../../../etc/Predicate.js';

export type Operator = 'is' | 'isOneOf' | 'isAtLeast' | 'isAtMost' | 'isExactly' | 'isBetween';

export const OPERATORS: Operator[] = [
	'is',
	'isOneOf',
	'isAtLeast',
	'isAtMost',
	'isExactly',
	'isBetween',
];

export interface RowState {
	key: string;
	operator: Operator;
	valueText: string;
	valueArray: string[];
	valueNumber: string;
	valueRangeMin: string;
	valueRangeMax: string;
}

export function detectOperator(stmt: unknown): Operator {
	if (Array.isArray(stmt)) return 'isOneOf';
	if (typeof stmt === 'string') return 'is';
	if (stmt && typeof stmt === 'object') {
		const s = stmt as { min?: unknown; max?: unknown; equal?: unknown };
		const hasMin = s.min !== undefined && s.min !== null && s.min !== '';
		const hasMax = s.max !== undefined && s.max !== null && s.max !== '';
		const hasEqual = s.equal !== undefined && s.equal !== null && s.equal !== '';
		if (hasEqual) return 'isExactly';
		if (hasMin && hasMax) return 'isBetween';
		if (hasMin) return 'isAtLeast';
		if (hasMax) return 'isAtMost';
	}
	return 'isExactly';
}

export function rowFromEntry(key: string, stmt: unknown): RowState {
	const operator = detectOperator(stmt);
	const row: RowState = {
		key,
		operator,
		valueText: '',
		valueArray: [],
		valueNumber: '',
		valueRangeMin: '',
		valueRangeMax: '',
	};
	if (typeof stmt === 'string') {
		row.valueText = stmt;
	} else if (Array.isArray(stmt)) {
		row.valueArray = stmt.map((v) => String(v));
	} else if (stmt && typeof stmt === 'object') {
		const s = stmt as { min?: number | string; max?: number | string; equal?: number | string };
		if (operator === 'isBetween') {
			row.valueRangeMin = s.min === undefined || s.min === null ? '' : String(s.min);
			row.valueRangeMax = s.max === undefined || s.max === null ? '' : String(s.max);
		} else if (operator === 'isAtLeast') {
			row.valueNumber = s.min === undefined || s.min === null ? '' : String(s.min);
		} else if (operator === 'isAtMost') {
			row.valueNumber = s.max === undefined || s.max === null ? '' : String(s.max);
		} else if (operator === 'isExactly') {
			row.valueNumber = s.equal === undefined || s.equal === null ? '' : String(s.equal);
		}
	}
	return row;
}

export function rowsFromValue(v: RawPredicate): RowState[] {
	return Object.entries(v ?? {}).map(([key, stmt]) => rowFromEntry(key, stmt));
}

export function maybeNumber(input: string): number | string {
	if (input === '') return '';
	const n = Number(input);
	return Number.isNaN(n) ? input : n;
}

export function rowToStatement(row: RowState): unknown {
	switch (row.operator) {
		case 'is':
			return row.valueText;
		case 'isOneOf':
			return row.valueArray.filter((v) => v !== '');
		case 'isAtLeast':
			return { min: maybeNumber(row.valueNumber) };
		case 'isAtMost':
			return { max: maybeNumber(row.valueNumber) };
		case 'isExactly':
			return { equal: maybeNumber(row.valueNumber) };
		case 'isBetween':
			return {
				min: maybeNumber(row.valueRangeMin),
				max: maybeNumber(row.valueRangeMax),
			};
	}
}

export function rowsToValue(rows: RowState[]): RawPredicate {
	const out: RawPredicate = {};
	for (const row of rows) {
		const trimmedKey = row.key.trim();
		if (!trimmedKey) continue;
		out[trimmedKey] = rowToStatement(row) as RawPredicate[string];
	}
	return out;
}

export function emptyRow(): RowState {
	return {
		key: '',
		operator: 'is',
		valueText: '',
		valueArray: [],
		valueNumber: '',
		valueRangeMin: '',
		valueRangeMax: '',
	};
}
