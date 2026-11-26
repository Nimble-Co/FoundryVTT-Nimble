import { actorRules } from '#utils/actor/actorRules.js';

interface SafeRestRule {
	type?: string;
	priority?: number;
	appliesTo?: () => boolean;
	healOnSafeRest?: (soFar: number, current: number) => number;
}

/**
 * How many Wounds a safe rest heals. 1 when no rule says otherwise, and never
 * more than `current` or less than 0.
 */
export function woundsHealedOnSafeRest(actor: object | null | undefined, current: number): number {
	const wounds = Math.floor(Number(current));
	if (!Number.isFinite(wounds) || wounds <= 0) return 0;

	const rules = actorRules<SafeRestRule>(actor as { rules?: unknown } | null | undefined)
		.filter((rule) => rule?.type === 'safeRestWounds' && (!rule.appliesTo || rule.appliesTo()))
		.map((rule, index) => ({ rule, index }))
		.sort((a, b) => (a.rule.priority ?? 0) - (b.rule.priority ?? 0) || a.index - b.index);

	let healed = 1;
	for (const { rule } of rules) {
		const next = rule.healOnSafeRest?.(healed, wounds);
		if (typeof next === 'number' && Number.isFinite(next)) healed = next;
	}
	return Math.max(0, Math.min(wounds, Math.floor(healed)));
}
