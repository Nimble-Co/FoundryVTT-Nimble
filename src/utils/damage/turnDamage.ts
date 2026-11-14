import type {
	CardEvent,
	CardEventMoment,
	CardEventText,
	TurnDamageAction,
	TurnMomentType,
} from '#types/cardEvent.d.ts';
import { ruleKey, ruleLabel, rulesOfType } from '#utils/actor/actorRules.js';
import { addMomentEvents, momentCard, momentEventIds } from '#utils/chat/cardEvents.js';
import { spacesBetween } from '#utils/movement/spacesBetween.js';
import { rollAmount } from '#utils/rolls/rollAmount.js';
import { saveRequestEvents } from '#utils/saveRequest/saveRequests.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import {
	dealTurnDamageLine,
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
	actor?: { uuid?: string | null } | null;
	/** The actor's roll data and `@stacks`. */
	rollData(): Record<string, unknown>;
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

/** One rule on one creature: its rolled line, waiting to be dealt, or null when it gives nothing. */
async function waitingLineFor(
	source: Source,
	target: TurnCreature,
	id: string,
): Promise<CardEvent | null> {
	const { rule } = source;
	const { amount } = await rollAmount(rule.formula.trim(), rule.rollData(), {
		purpose: 'of a turn',
		show: true,
	});
	const wounds = rule.wounds > 0 && hasWoundTrack(target) ? rule.wounds : 0;
	if (amount < 1 && wounds < 1) return null;
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
	return turnDamageEvent({
		id,
		action,
		cause: causeOf(source),
		img: rule.parentDocument?.img ?? null,
		at: Date.now(),
	});
}

/** Deals each written line, with what it took on the line, so Undo can give it back. */
async function dealLines(
	target: TurnCreature,
	written: CardEvent[],
	moment: CardEventMoment,
): Promise<void> {
	const card = momentCard(moment.key);
	if (!card) return;
	const saves: CardEvent[] = [];
	for (const line of written) {
		const losses = await dealTurnDamageLine(card, line, target, { moment });
		if (losses && losses.hpLost + losses.tempLost > 0) {
			saves.push(...saveRequestEvents(target as never, 'takeDamage'));
		}
	}
	if (saves.length > 0) await addMomentEvents(moment, saves);
}

/**
 * On the active GM, after the Lasts Until ends of the moment: the Damage Each Turn rules that
 * reach the creature whose turn starts or ends. The lines go on the card of the moment before the
 * damage is dealt, so no damage is dealt without its line. A line already on that card (a turn
 * rewound and played again) is not dealt again. With Feature Effects off, the lines wait.
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
		const line = await waitingLineFor(source, target, id);
		if (line) lines.push(line);
	}
	if (lines.length < 1) return;
	if (!(await addMomentEvents(moment, lines))) return;
	if (isRuleAutomationEnabled()) await dealLines(target, lines, moment);
}
