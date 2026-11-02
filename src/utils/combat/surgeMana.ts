import { SYSTEM_ID } from '#system';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { canShowDiceAnimation, showDiceAnimation } from '../rolls/showDiceAnimation.js';

export interface SurgeDie {
	faces: number;
	value: number;
	/** The value before the die rolled again. */
	was?: number;
}

/** The surge on an Initiative card. */
export interface CardSurge {
	feature: string;
	flat: number;
	dice: SurgeDie[];
	/** The feature that lets a 1 roll again; empty with none. */
	rerollFeature: string;
	manaGiven: boolean;
	combatId: string;
}

interface SurgeActor {
	rules?: Iterable<unknown>;
	system?: { resources?: { mana?: { current?: number } } };
	getFlag?(scope: string, key: string): unknown;
	update?(changes: Record<string, unknown>): Promise<unknown>;
}

const SURGE_FLAG = 'surgeMana';

interface SurgeFlag {
	combatId: string;
	/** The mana before the surge. All above this at the end of combat is what the surge left. */
	before: number;
}

async function rollDice(formula: string): Promise<SurgeDie[]> {
	if (!/^\d+d\d+$/i.test(formula)) return [];
	const roll = new foundry.dice.Roll(formula);
	await roll.evaluate();
	if (canShowDiceAnimation()) await showDiceAnimation(roll as never);
	return roll.dice.flatMap((die) =>
		die.results.map((result) => ({ faces: die.faces ?? 4, value: result.result })),
	);
}

export function surgeTotal(surge: Pick<CardSurge, 'flat' | 'dice'>): number {
	return surge.flat + surge.dice.reduce((sum, die) => sum + die.value, 0);
}

/** Whether this die shows a 1 that can roll again. */
export function canRerollSurgeDie(surge: CardSurge, die: SurgeDie): boolean {
	return !!surge.rerollFeature && die.value === 1 && die.was === undefined;
}

async function rerollDie(die: SurgeDie): Promise<SurgeDie> {
	const [next] = await rollDice(`1d${die.faces}`);
	return { faces: die.faces, value: next?.value ?? die.value, was: die.value };
}

/** Give the surge's mana, once per combat. */
export async function giveSurgeMana(actor: SurgeActor, surge: CardSurge): Promise<void> {
	const before = Number(actor.system?.resources?.mana?.current) || 0;
	await actor.update?.({
		'system.resources.mana.current': before + surgeTotal(surge),
		[`flags.${SYSTEM_ID}.${SURGE_FLAG}`]: { combatId: surge.combatId, before },
	});
}

/**
 * The surge an Initiative roll in this combat makes: the dice, and with Feature
 * Effects on, a reroll of each 1 and the mana. Null with no rule, with no combat,
 * or when this combat has its surge.
 */
export async function rollSurge(
	actor: SurgeActor | null | undefined,
	combatId: string | null,
): Promise<CardSurge | null> {
	if (!actor?.rules || !combatId) return null;
	const flag = actor.getFlag?.(SYSTEM_ID, SURGE_FLAG) as SurgeFlag | undefined;
	if (flag?.combatId === combatId) return null;

	const rules = Array.from(actor.rules) as Array<{
		type?: string;
		surgeSpec?: { feature: string; flat: number; dice: string } | null;
		rerollFeature?: string | null;
	}>;
	const spec = rules.find((rule) => rule?.type === 'surgeMana' && rule.surgeSpec)?.surgeSpec;
	if (!spec) return null;
	const rerollFeature =
		rules.find((rule) => rule?.type === 'surgeRerollOnes' && rule.rerollFeature)?.rerollFeature ??
		'';

	const surge: CardSurge = {
		feature: spec.feature,
		flat: spec.flat,
		dice: await rollDice(spec.dice),
		rerollFeature,
		manaGiven: false,
		combatId,
	};
	if (!isRuleAutomationEnabled()) return surge;

	surge.dice = await Promise.all(
		surge.dice.map((die) => (canRerollSurgeDie(surge, die) ? rerollDie(die) : die)),
	);
	await giveSurgeMana(actor, surge);
	surge.manaGiven = true;
	return surge;
}

interface SurgeCard {
	system: { surge?: CardSurge | null };
	update(changes: Record<string, unknown>): Promise<unknown>;
}

/** A row on the card: this 1 rolls again. */
export async function rerollSurgeDieOnCard(card: SurgeCard, index: number): Promise<void> {
	const surge = card.system.surge;
	const die = surge?.dice[index];
	if (!surge || !die || surge.manaGiven || !canRerollSurgeDie(surge, die)) return;
	const dice = [...surge.dice];
	dice[index] = await rerollDie(die);
	await card.update({ 'system.surge.dice': dice });
}

/** A button on the card: the mana. */
export async function regainSurgeManaOnCard(
	card: SurgeCard,
	actor: SurgeActor | null | undefined,
): Promise<void> {
	const surge = card.system.surge;
	if (!surge || surge.manaGiven || !actor) return;
	await giveSurgeMana(actor, surge);
	await card.update({ 'system.surge.manaGiven': true });
}

/** What the surge left goes away with its combat. Mana spent counts as surge mana first. */
export async function endSurgeMana(actor: SurgeActor, combatId: string): Promise<void> {
	const flag = actor.getFlag?.(SYSTEM_ID, SURGE_FLAG) as SurgeFlag | undefined;
	if (flag?.combatId !== combatId) return;
	const current = Number(actor.system?.resources?.mana?.current) || 0;
	await actor.update?.({
		'system.resources.mana.current': Math.min(current, flag.before),
		[`flags.${SYSTEM_ID}.${SURGE_FLAG}`]: new foundry.data.operators.ForcedDeletion(),
	});
}
