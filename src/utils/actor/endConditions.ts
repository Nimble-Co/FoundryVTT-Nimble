import type { EndConditionsNode } from '#types/effectTree.js';

/** States the system sets from HP, Wounds and spells: an End Conditions step never ends them. */
export const NEVER_ENDED = new Set([
	'bloodied',
	'dying',
	'dead',
	'wounded',
	'lastStand',
	'concentration',
]);

interface EndableEffect {
	statuses?: Set<string>;
	disabled?: boolean;
}

interface EffectHolder<Effect extends EndableEffect> {
	effects?: Iterable<Effect>;
	statuses?: Set<string>;
}

interface ConditionConfig {
	conditionNegativeConditions?: Set<string>;
	conditionCountsAs?: Record<string, readonly string[]>;
	conditionTriggerRelationships?: Record<string, { triggeredBy: readonly string[] }>;
}

const config = () => (CONFIG.NIMBLE ?? {}) as unknown as ConditionConfig;

/** The status, with each status it counts as (Stunned counts as Incapacitated). */
function countsAs(status: string): readonly string[] {
	return [status, ...(config().conditionCountsAs?.[status] ?? [])];
}

function matches(status: string, node: EndConditionsNode): boolean {
	if (NEVER_ENDED.has(status)) return false;
	if (node.which === 'negative') return !!config().conditionNegativeConditions?.has(status);
	return countsAs(status).some((id) => node.conditions.includes(id));
}

/** A condition that another condition on the creature gives goes when that one goes. */
function givenByAnother(status: string, held: ReadonlySet<string>): boolean {
	const triggers = config().conditionTriggerRelationships?.[status]?.triggeredBy ?? [];
	return triggers.some((trigger) => held.has(trigger));
}

/** The creature's own effects that the step ends, each as a whole. Item effects stay. */
export function effectsToEnd<Effect extends EndableEffect>(
	actor: EffectHolder<Effect>,
	node: EndConditionsNode,
): Effect[] {
	const held = actor.statuses ?? new Set<string>();
	return [...(actor.effects ?? [])].filter(
		(effect) =>
			!effect.disabled &&
			[...(effect.statuses ?? [])].some(
				(status) => matches(status, node) && !givenByAnother(status, held),
			),
	);
}
