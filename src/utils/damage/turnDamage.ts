import type {
	CardEvent,
	CardEventMoment,
	CardEventText,
	TurnDamageAction,
	TurnMomentType,
} from '#types/cardEvent.d.ts';
import { ruleKey, ruleLabel, rulesOfType } from '#utils/actor/actorRules.js';
import { addMomentEvents, momentEventIds } from '#utils/chat/cardEvents.js';
import { spacesBetween } from '#utils/movement/spacesBetween.js';
import { showDiceAnimation } from '#utils/rolls/showDiceAnimation.js';
import { saveRequestEvents } from '#utils/saveRequest/saveRequests.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import {
	dealTurnDamageTo,
	hasWoundTrack,
	type TurnDamageHolder,
	turnDamageEvent,
} from './turnDamageLine.js';

const WORDS = 'NIMBLE.chat.turnDamage';

interface TurnDamageRuleLike {
	id?: string | null;
	type?: string;
	label?: string;
	at: TurnMomentType;
	who: 'holder' | 'nearby';
	reach: number;
	formula: string;
	damageType: string;
	wounds: number;
	actor?: { uuid?: string | null; getRollData?(): Record<string, unknown> } | null;
	parentDocument?: { uuid?: string | null; name?: string | null; img?: string | null } | null;
	appliesTo(): boolean;
}

interface TurnCreature extends TurnDamageHolder {
	statuses?: Set<string>;
	rules?: unknown;
}

interface SceneToken {
	id?: string | null;
	actor?: TurnCreature | null;
	combatant?: { isDefeated?: boolean } | null;
	parent?: { tokens?: Iterable<SceneToken> } | null;
}

interface TurnCombatant {
	actor?: TurnCreature | null;
	token?: SceneToken | null;
	isDefeated?: boolean;
}

/** A creature that deals or takes no damage: dead, or defeated in the combat. */
function isOut(actor: TurnCreature, defeated: boolean | undefined): boolean {
	return !!defeated || !!actor.statuses?.has('dead');
}

function rulesAt(actor: TurnCreature, type: TurnMomentType, who: 'holder' | 'nearby') {
	return (rulesOfType(actor, 'turnDamage') as unknown as TurnDamageRuleLike[]).filter(
		(rule) => rule.who === who && rule.at === type && rule.appliesTo(),
	);
}

interface Source {
	rule: TurnDamageRuleLike;
	/** The creature that has the rule, when it is not the one that takes it. */
	near: TurnCreature | null;
}

/** The creature's own rules, and the rules of each other creature on its scene that reach it. */
function sourcesFor(
	type: TurnMomentType,
	target: TurnCreature,
	token: SceneToken | null,
): Source[] {
	const sources: Source[] = rulesAt(target, type, 'holder').map((rule) => ({ rule, near: null }));
	if (!token) return sources;
	for (const other of token.parent?.tokens ?? []) {
		const actor = other.actor;
		if (!actor || other === token || actor === target) continue;
		if (isOut(actor, other.combatant?.isDefeated)) continue;
		for (const rule of rulesAt(actor, type, 'nearby')) {
			if (spacesBetween(other as never, token as never) <= rule.reach) {
				sources.push({ rule, near: actor });
			}
		}
	}
	return sources;
}

async function rolledAmount(rule: TurnDamageRuleLike): Promise<number> {
	const formula = rule.formula.trim();
	if (!formula) return 0;
	try {
		const roll = new Roll(formula, rule.actor?.getRollData?.() ?? {});
		await roll.evaluate();
		await showDiceAnimation(roll);
		const total = Math.floor(Number(roll.total));
		return Number.isFinite(total) && total > 0 ? total : 0;
	} catch (error) {
		console.warn(`Nimble | Could not roll the damage "${formula}" of a turn.`, error);
		return 0;
	}
}

function causeOf({ rule, near }: Source): CardEventText {
	const label = ruleLabel(rule as never);
	const source: CardEventText | string = near
		? { key: `${WORDS}.nearSource`, data: { source: label, creature: near.name ?? '' } }
		: label;
	const formula = rule.formula.trim();
	return formula
		? { key: `${WORDS}.cause`, data: { source, formula } }
		: { key: `${WORDS}.causeNoFormula`, data: { source } };
}

/** One rule on one creature: the line, with the damage dealt unless Feature Effects are off. */
async function linesFor(
	source: Source,
	target: TurnCreature,
	id: string,
	moment: CardEventMoment,
): Promise<CardEvent[]> {
	const { rule } = source;
	const amount = await rolledAmount(rule);
	const wounds = rule.wounds > 0 && hasWoundTrack(target) ? rule.wounds : 0;
	if (amount < 1 && wounds < 1) return [];
	const action: TurnDamageAction = {
		kind: 'turnDamage',
		holderUuid: target.uuid,
		holderName: target.name ?? '',
		amount,
		damageType: rule.damageType ?? '',
		wounds,
		sourceUuid: rule.actor?.uuid ?? null,
		state: 'waiting',
	};
	const dealt = isRuleAutomationEnabled();
	const losses = dealt ? await dealTurnDamageTo(target, action, { moment }) : null;
	const line = turnDamageEvent({
		id,
		action: losses ? { ...action, ...losses, state: 'dealt' } : action,
		cause: causeOf(source),
		img: rule.parentDocument?.img ?? null,
		at: Date.now(),
	});
	if (!line) return [];
	const hurt = !!losses && losses.hpLost + losses.tempLost > 0;
	return [line, ...(hurt ? saveRequestEvents(target as never, 'takeDamage') : [])];
}

/**
 * On the active GM, after the Lasts Until ends of the moment: the Damage Each Turn rules that
 * reach the creature whose turn starts or ends. The lines go on the card of the moment. A line
 * already on that card (a turn rewound and played again) is not dealt again.
 */
export async function dealTurnDamage(
	type: TurnMomentType,
	combatant: TurnCombatant | null | undefined,
	moment: CardEventMoment,
): Promise<void> {
	const target = combatant?.actor;
	if (!game.user?.isActiveGM || !target || isOut(target, combatant?.isDefeated)) return;
	const sources = sourcesFor(type, target, combatant?.token ?? null);
	if (sources.length < 1) return;
	const seen = momentEventIds(moment.key);
	const lines: CardEvent[] = [];
	for (const source of sources) {
		const id = `turnDamage.${ruleKey(source.rule as never)}.${target.uuid}.${moment.key}`;
		if (seen.has(id)) continue;
		lines.push(...(await linesFor(source, target, id, moment)));
	}
	if (lines.length > 0) await addMomentEvents(moment, lines);
}
