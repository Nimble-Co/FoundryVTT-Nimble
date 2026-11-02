import type { CritDiceLine } from '#types/critDice.d.ts';

interface CritDieTermView {
	options?: { flavor?: string; dieRole?: string; critDiceKey?: string };
	results?: Array<{ result: number; active?: boolean; discarded?: boolean }>;
}

/** One line per feature that added crit dice to these terms. */
export function critDiceLinesOf(terms: readonly unknown[] | null | undefined): CritDiceLine[] {
	const lines = new Map<string, CritDiceLine>();
	for (const term of (terms ?? []) as CritDieTermView[]) {
		const options = term?.options;
		if (!options?.dieRole) continue;
		const key = options.critDiceKey ?? '';
		const line = lines.get(key) ?? {
			label: options.flavor ?? '',
			role: options.dieRole,
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
