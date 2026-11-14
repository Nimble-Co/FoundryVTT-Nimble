import type { CardEvent, TurnDamageAction } from '#types/cardEvent.d.ts';
import { formulaWithStacks, stacksOf } from '#utils/actor/effectStacks.js';
import {
	addCardEvents,
	cardEventsOf,
	cardHoldingEvent,
	replaceCardEvent,
} from '#utils/chat/cardEvents.js';
import {
	dealTurnDamageLine,
	type TurnDamageHolder,
	turnDamageEvent,
	undoTurnDamage,
} from '#utils/damage/turnDamageLine.js';
import { rulesOfEffect } from '#utils/documents/rulesOfEffect.js';
import { rollAmount } from '#utils/rolls/rollAmount.js';
import { saveRequestEvents } from '#utils/saveRequest/saveRequests.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';

/** A Damage on Escape rule, read before its effect ends. */
export interface EscapeDamageRuleData {
	id?: string | null;
	formula: string;
	damageType: string;
}

interface RuleSource extends Partial<EscapeDamageRuleData> {
	type?: string;
	disabled?: boolean;
	appliesTo?(): boolean;
}

interface EscapedEffect {
	effectId: string;
	effectName: string;
	img?: string | null;
	/** The creature that applied the effect, for the damage type's follow-ups. */
	sourceUuid: string | null;
}

interface EscapeHolder extends TurnDamageHolder {
	getRollData?(): Record<string, unknown>;
}

interface HostCard {
	id?: string | null;
	flags?: Record<string, unknown>;
}

/** The Damage on Escape rules of the effect that are on: its prepared rules, else its rule data. */
export function escapeDamageRulesOf(effect: {
	rules?: unknown;
	system?: unknown;
}): EscapeDamageRuleData[] {
	const stacks = stacksOf(effect.system)?.count ?? 1;
	return rulesOfEffect<RuleSource>(effect)
		.filter(
			(rule) =>
				rule?.type === 'escapeDamage' &&
				!rule.disabled &&
				(typeof rule.appliesTo !== 'function' || rule.appliesTo()),
		)
		.map((rule) => ({
			id: rule.id ?? null,
			formula: formulaWithStacks(rule.formula ?? '', stacks),
			damageType: rule.damageType ?? '',
		}));
}

/** The lines of one escape: its holder, its effect and its roll card, wherever the lines are now. */
const lineIdPrefix = (holderUuid: string, effectId: string, rollCardId: string) =>
	`escapeDamage.${holderUuid}.${effectId}.${rollCardId}.`;

/**
 * On the active GM, after an Escape ended the effect: each rule's damage to the holder (not an
 * attack). The lines go on the roll card, waiting, before any damage, so no damage is dealt
 * without its line; each is then dealt as a Take click deals it. With Feature Effects off, the
 * lines wait for a click.
 */
export async function dealEscapeDamage(
	card: HostCard,
	holder: EscapeHolder,
	escaped: EscapedEffect,
	rules: readonly EscapeDamageRuleData[],
): Promise<void> {
	if (!card.id) return;
	const lines: CardEvent[] = [];
	for (const rule of rules) {
		const formula = rule.formula.trim();
		const { amount } = await rollAmount(formula, holder.getRollData?.() ?? {}, {
			purpose: 'of an escape',
			show: true,
		});
		if (amount < 1) continue;
		const action: TurnDamageAction = {
			kind: 'turnDamage',
			holderUuid: holder.uuid,
			holderName: holder.name ?? '',
			amount,
			damageType: rule.damageType,
			wounds: 0,
			sourceUuid: escaped.sourceUuid,
			state: 'waiting',
		};
		const at = Date.now();
		const line = turnDamageEvent({
			id: `${lineIdPrefix(holder.uuid, escaped.effectId, card.id)}${rule.id ?? lines.length}.${at}`,
			action,
			cause: {
				key: 'NIMBLE.chat.escapeDamage.cause',
				data: { effect: escaped.effectName, formula },
			},
			img: escaped.img ?? null,
			at,
		});
		if (line) lines.push(line);
	}
	if (lines.length < 1) return;
	if (!(await addCardEvents(card as never, lines))) return;
	if (!isRuleAutomationEnabled()) return;
	const saves: CardEvent[] = [];
	for (const line of lines) {
		const host = cardHoldingEvent(line.id, card as never);
		if (!host) continue;
		const losses = await dealTurnDamageLine(host, line, holder, { id: card.id });
		if (losses && losses.hpLost + losses.tempLost > 0) {
			saves.push(...saveRequestEvents(holder as never, 'takeDamage'));
		}
	}
	if (saves.length > 0) await addCardEvents(card as never, saves);
}

/**
 * The escape no longer stands: give back what its damage took, and take its lines off, on the roll
 * card or on the card they moved to.
 */
export async function takeBackEscapeDamage(
	card: HostCard,
	escaped: { holderUuid: string; effectId: string },
): Promise<void> {
	if (!card.id) return;
	const prefix = lineIdPrefix(escaped.holderUuid, escaped.effectId, card.id);
	const host = cardHoldingEvent((id) => id.startsWith(prefix), card as never);
	if (!host) return;
	const lines = cardEventsOf(host as never).filter(
		(event) => event.id.startsWith(prefix) && event.action?.kind === 'turnDamage',
	);
	for (const line of lines) {
		if (line.action?.kind === 'turnDamage' && line.action.state === 'dealt') {
			await undoTurnDamage(host, line);
		}
		await replaceCardEvent(host as never, line.id, null);
	}
}
