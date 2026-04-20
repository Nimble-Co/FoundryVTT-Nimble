export type ParsedDie = { termIndex: number; dieIndex: number; faces: number };

export type DieResultDump = {
	result: number;
	active: boolean;
	discarded: boolean;
	exploded: boolean;
	provenance: string | null;
};

export type TermDump = {
	type: string;
	formula: string;
	faces: number | null;
	results: DieResultDump[] | null;
	/**
	 * For Die terms: the configured die count (used to split base dice from
	 * post-evaluation explosion rerolls in the results array).
	 * For NumericTerm: the numeric value.
	 */
	number: number | null;
	operator: string | null;
};

export type TraceDump = {
	isCritical: boolean;
	isMiss: boolean;
	total: number;
	stagedValuesRemaining: number;
};

export type ResultDump = {
	trace: TraceDump;
	isCritical: boolean | undefined;
	isMiss: boolean | undefined;
	total: number | null | undefined;
	terms: TermDump[];
};

export type TestbenchActor = {
	id: string;
	name: string;
	type: string;
	getRollData?: () => Record<string, unknown>;
};

export type CategorizedDie = {
	result: number;
	active: boolean;
	discarded: boolean;
	exploded: boolean;
	category: 'kept' | 'dropped' | 'critReroll' | 'viciousChain' | 'viciousBonus';
};

export type CategorizedPrimary = { faces: number | null; dice: CategorizedDie[] };
