import { SYSTEM_ID } from '#system';
import type { CardInitiativeMana, InitiativeManaDie } from '#types/initiativeManaRoll.d.ts';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { canShowDiceAnimation, showDiceAnimation } from '../rolls/showDiceAnimation.js';

interface InitiativeManaActor {
	rules?: Iterable<unknown>;
	system?: { resources?: { mana?: { current?: number } } };
	getFlag?(scope: string, key: string): unknown;
	update?(changes: Record<string, unknown>): Promise<unknown>;
}

const SURGE_FLAG = 'initiativeManaRoll';

interface InitiativeManaFlag {
	combatId: string;
	/** The mana before the initiativeMana. All above this at the end of combat is what the initiativeMana left. */
	before: number;
}

async function rollDice(formula: string): Promise<InitiativeManaDie[]> {
	if (!/^\d+d\d+$/i.test(formula)) return [];
	const roll = new foundry.dice.Roll(formula);
	await roll.evaluate();
	if (canShowDiceAnimation()) await showDiceAnimation(roll as never);
	return roll.dice.flatMap((die) =>
		die.results.map((result) => ({ faces: die.faces ?? 4, value: result.result })),
	);
}

export function initiativeManaTotal(
	initiativeMana: Pick<CardInitiativeMana, 'flat' | 'dice'>,
): number {
	return initiativeMana.flat + initiativeMana.dice.reduce((sum, die) => sum + die.value, 0);
}

/** Whether this die shows a 1 that can roll again. */
export function canRerollInitiativeManaDie(
	initiativeMana: CardInitiativeMana,
	die: InitiativeManaDie,
): boolean {
	return !!initiativeMana.rerollFeature && die.value === 1 && die.was === undefined;
}

async function rerollDie(die: InitiativeManaDie): Promise<InitiativeManaDie> {
	const [next] = await rollDice(`1d${die.faces}`);
	return { faces: die.faces, value: next?.value ?? die.value, was: die.value };
}

/** Give the initiativeMana's mana, once per combat. */
export async function giveInitiativeMana(
	actor: InitiativeManaActor,
	initiativeMana: CardInitiativeMana,
): Promise<void> {
	const before = Number(actor.system?.resources?.mana?.current) || 0;
	await actor.update?.({
		'system.resources.mana.current': before + initiativeManaTotal(initiativeMana),
		[`flags.${SYSTEM_ID}.${SURGE_FLAG}`]: { combatId: initiativeMana.combatId, before },
	});
}

/**
 * The initiativeMana an Initiative roll in this combat makes: the dice, and with Feature
 * Effects on, a reroll of each 1 and the mana. Null with no rule, with no combat,
 * or when this combat has its initiativeMana.
 */
export async function rollInitiativeMana(
	actor: InitiativeManaActor | null | undefined,
	combatId: string | null,
): Promise<CardInitiativeMana | null> {
	if (!actor?.rules || !combatId) return null;
	const flag = actor.getFlag?.(SYSTEM_ID, SURGE_FLAG) as InitiativeManaFlag | undefined;
	if (flag?.combatId === combatId) return null;

	const rules = Array.from(actor.rules) as Array<{
		type?: string;
		initiativeManaSpec?: { feature: string; flat: number; dice: string } | null;
		rerollFeature?: string | null;
	}>;
	const spec = rules.find(
		(rule) => rule?.type === 'initiativeMana' && rule.initiativeManaSpec,
	)?.initiativeManaSpec;
	if (!spec) return null;
	const rerollFeature =
		rules.find((rule) => rule?.type === 'initiativeManaRerollOnes' && rule.rerollFeature)
			?.rerollFeature ?? '';

	const initiativeMana: CardInitiativeMana = {
		feature: spec.feature,
		flat: spec.flat,
		dice: await rollDice(spec.dice),
		rerollFeature,
		manaGiven: false,
		combatId,
	};
	if (!isRuleAutomationEnabled()) return initiativeMana;

	initiativeMana.dice = await Promise.all(
		initiativeMana.dice.map((die) =>
			canRerollInitiativeManaDie(initiativeMana, die) ? rerollDie(die) : die,
		),
	);
	await giveInitiativeMana(actor, initiativeMana);
	initiativeMana.manaGiven = true;
	return initiativeMana;
}

interface InitiativeManaCard {
	system: { initiativeMana?: CardInitiativeMana | null };
	update(changes: Record<string, unknown>): Promise<unknown>;
}

/** A row on the card: this 1 rolls again. */
export async function rerollInitiativeManaDieOnCard(
	card: InitiativeManaCard,
	index: number,
): Promise<void> {
	const initiativeMana = card.system.initiativeMana;
	const die = initiativeMana?.dice[index];
	if (
		!initiativeMana ||
		!die ||
		initiativeMana.manaGiven ||
		!canRerollInitiativeManaDie(initiativeMana, die)
	)
		return;
	const dice = [...initiativeMana.dice];
	dice[index] = await rerollDie(die);
	await card.update({ 'system.initiativeMana.dice': dice });
}

/** A button on the card: the mana. */
export async function regainInitiativeManaOnCard(
	card: InitiativeManaCard,
	actor: InitiativeManaActor | null | undefined,
): Promise<void> {
	const initiativeMana = card.system.initiativeMana;
	if (!initiativeMana || initiativeMana.manaGiven || !actor) return;
	await giveInitiativeMana(actor, initiativeMana);
	await card.update({ 'system.initiativeMana.manaGiven': true });
}

/** What the initiativeMana left goes away with its combat. Mana spent counts as initiativeMana mana first. */
export async function endInitiativeMana(
	actor: InitiativeManaActor,
	combatId: string,
): Promise<void> {
	const flag = actor.getFlag?.(SYSTEM_ID, SURGE_FLAG) as InitiativeManaFlag | undefined;
	if (flag?.combatId !== combatId) return;
	const current = Number(actor.system?.resources?.mana?.current) || 0;
	await actor.update?.({
		'system.resources.mana.current': Math.min(current, flag.before),
		[`flags.${SYSTEM_ID}.${SURGE_FLAG}`]: new foundry.data.operators.ForcedDeletion(),
	});
}
