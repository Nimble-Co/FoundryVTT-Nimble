import { rulesOfType } from '#utils/actor/actorRules.js';

interface CostedSpell {
	type?: string;
	system?: { identifier?: string; tier?: number };
}

/** The change the caster's Spell Mana Cost rules make to the mana a cast of this spell costs. */
export function spellManaCostChange(
	actor: { rules?: unknown } | null | undefined,
	spell: CostedSpell | null | undefined,
): number {
	return rulesOfType(actor, 'spellManaCost')
		.filter((rule) => rule.appliesTo() && rule.matchesSpell(spell))
		.reduce((change, rule) => change + (rule.resolveValue() ?? 0), 0);
}

/** A mana cost after a change, never below 0. */
export function withManaCostChange(mana: number, change: number): number {
	return Math.max(0, mana + change);
}
