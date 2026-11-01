import localize from '../localize.js';

// The Incapacitated group, the most specific name first: a Petrified creature is also Incapacitated.
const GROUP = ['petrified', 'paralyzed', 'stunned', 'unconscious', 'incapacitated'] as const;

interface CreatureLike {
	getTargetDomain?(): Set<string>;
	statuses?: ReadonlySet<string>;
}

/** The condition that puts this creature in the Incapacitated group, or null. */
export function incapacitatedConditionOf(creature: CreatureLike | null | undefined): string | null {
	if (!creature?.getTargetDomain?.().has('target:incapacitated')) return null;
	return GROUP.find((condition) => creature.statuses?.has(condition)) ?? 'incapacitated';
}

/** The condition's name, as the card names the cause of a crit. */
export function incapacitatedCause(condition: string): string {
	return localize('NIMBLE.chat.incomingReactions.incapacitatedCause', {
		condition: localize(`NIMBLE.conditions.${condition}`),
	});
}

/** The condition's name, as a card button names what gives the crit. */
export function incapacitatedFeature(condition: string): string {
	return localize('NIMBLE.chat.incomingReactions.incapacitatedFeature', {
		condition: localize(`NIMBLE.conditions.${condition}`),
	});
}
