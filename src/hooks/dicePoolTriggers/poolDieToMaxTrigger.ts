import type { MeasurableTokenDocument } from '#types/movement.js';
import { woundsGained } from '#utils/actor/actorHpChangePaths.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { areAllies } from '#utils/movement/alliesWithin.js';
import { findActorToken } from '#utils/movement/findActorToken.js';
import { spacesBetween } from '#utils/movement/spacesBetween.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';

interface PoolDieToMaxRuleLike {
	type?: string;
	trigger?: string;
	reach?: number;
	item?: { uuid?: string };
	appliesTo?(): boolean;
	raiseDice?(count: number): Promise<void>;
}

interface FreeMoveRuleLike {
	type?: string;
	trigger?: string;
	item?: { uuid?: string };
	offerAfterPoolDice?(): Promise<void>;
}

type RuleActor = { rules?: Iterable<unknown>; type?: string; uuid?: string };

function rulesOf<T>(actor: RuleActor | null | undefined): T[] {
	return actor?.rules ? (Array.from(actor.rules) as T[]) : [];
}

function poolDieRules(actor: RuleActor | null | undefined, trigger: string) {
	return rulesOf<PoolDieToMaxRuleLike>(actor).filter(
		(rule) => rule?.type === 'poolDieToMax' && rule.trigger === trigger && rule.appliesTo?.(),
	);
}

/** Raise the dice, then arm the free move of the same item, also with no dice held. */
async function useRule(rule: PoolDieToMaxRuleLike, actor: RuleActor, count: number): Promise<void> {
	if (isRuleAutomationEnabled()) await rule.raiseDice?.(count);
	for (const move of rulesOf<FreeMoveRuleLike>(actor)) {
		if (move?.type !== 'freeMove' || move.trigger !== 'afterPoolDiceToMax') continue;
		if (move.item?.uuid === rule.item?.uuid) await move.offerAfterPoolDice?.();
	}
}

/** On each attack against a hero: the refills ran, so a die can go to its max. */
export async function raisePoolDiceOnAttacked(actor: RuleActor): Promise<void> {
	if (!isRuleAutomationEnabled()) return;
	for (const rule of poolDieRules(actor, 'onAttacked')) await rule.raiseDice?.(1);
}

function inReach(hero: TokenDocument, ally: TokenDocument, reach: number): boolean {
	if (!areAllies(hero, ally)) return false;
	return (
		spacesBetween(
			hero as unknown as MeasurableTokenDocument,
			ally as unknown as MeasurableTokenDocument,
		) <= reach
	);
}

/** On Wounds: the hero's own rules, then the rules of other heroes with the wounded one in reach. */
export async function raisePoolDiceOnWounds(wounded: RuleActor, wounds: number): Promise<void> {
	for (const rule of poolDieRules(wounded, 'onWound')) await useRule(rule, wounded, wounds);

	const woundedToken = findActorToken(wounded as Actor);
	const tokens = woundedToken?.parent?.tokens as Iterable<TokenDocument> | undefined;
	if (!woundedToken || !tokens) return;
	const seen = new Set<string | undefined>([wounded.uuid]);
	for (const token of tokens) {
		const hero = token.actor as RuleActor | null;
		if (!hero || hero.type !== 'character' || seen.has(hero.uuid)) continue;
		seen.add(hero.uuid);
		for (const rule of poolDieRules(hero, 'onWound')) {
			const reach = Number(rule.reach) || 0;
			if (reach > 0 && inReach(token, woundedToken, reach)) await useRule(rule, hero, wounds);
		}
	}
}

let registered = false;

export function registerPoolDieToMaxTriggerHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on('updateActor', (actor: Actor.Implementation, _changes: unknown, options: unknown) => {
		if (actor.type !== 'character' || !isActiveGM()) return;
		const wounds = woundsGained(actor, options);
		if (wounds > 0) void raisePoolDiceOnWounds(actor as unknown as RuleActor, wounds);
	});
}
