import type { CritDiceLine, CritDiceOptions } from '#types/critDice.d.ts';

interface CritDieTermView {
	options?: { flavor?: string; critDiceKey?: string };
	results?: Array<{ result: number; active?: boolean; discarded?: boolean }>;
}

/** The role of the dice of a term that a crit added, or undefined for any other term. */
export function dieRoleOf(term: unknown): string | undefined {
	return (term as { options?: CritDiceOptions } | null | undefined)?.options?.dieRole;
}

/** Whether a die result is the d20 crit die: only that result has faces of its own. */
export function isCritD20Result(result: unknown): boolean {
	return !!(result as { faces?: number } | null | undefined)?.faces;
}

/** One line per feature that added crit dice to these terms. */
export function critDiceLinesOf(terms: readonly unknown[] | null | undefined): CritDiceLine[] {
	const lines = new Map<string, CritDiceLine>();
	for (const term of (terms ?? []) as CritDieTermView[]) {
		const role = dieRoleOf(term);
		if (!role) continue;
		const options = term.options;
		const key = options?.critDiceKey ?? '';
		const line = lines.get(key) ?? {
			label: options?.flavor ?? '',
			role,
			values: [],
			total: 0,
		};
		for (const result of term.results ?? []) {
			if (result.active === false || result.discarded) continue;
			line.values.push(result.result);
			line.total += result.result;
		}
		lines.set(key, line);
	}
	return [...lines.values()];
}
