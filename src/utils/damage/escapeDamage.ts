import type { CardEvent, TurnDamageAction } from '#types/cardEvent.d.ts';
import { formulaWithStacks, stacksOf } from '#utils/actor/effectStacks.js';
import { addCardEvents, cardEventsOf, replaceCardEvent } from '#utils/chat/cardEvents.js';
import {
	dealTurnDamageTo,
	type TurnDamageHolder,
	turnDamageEvent,
	undoTurnDamage,
} from '#utils/damage/turnDamageLine.js';
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
	const prepared = effect.rules as { values?(): Iterable<RuleSource> } | undefined;
	const rules =
		typeof prepared?.values === 'function'
			? [...prepared.values()]
			: ((effect.system as { rules?: RuleSource[] } | undefined)?.rules ?? []);
	const stacks = stacksOf(effect.system)?.count ?? 1;
	return rules
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

const lineIdPrefix = (holderUuid: string, effectId: string) =>
	`escapeDamage.${holderUuid}.${effectId}.`;

/**
 * On the active GM, after an Escape ended the effect: each rule's damage to the holder (not an
 * attack), with its line on the roll card. With Feature Effects off, the line waits for a click.
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
		const losses = isRuleAutomationEnabled()
			? await dealTurnDamageTo(holder, action, { id: card.id })
			: null;
		const at = Date.now();
		const line = turnDamageEvent({
			id: `${lineIdPrefix(holder.uuid, escaped.effectId)}${rule.id ?? lines.length}.${at}`,
			action: losses ? { ...action, ...losses, state: 'dealt' } : action,
			cause: {
				key: 'NIMBLE.chat.escapeDamage.cause',
				data: { effect: escaped.effectName, formula },
			},
			img: escaped.img ?? null,
			at,
		});
		if (!line) continue;
		lines.push(line);
		if (losses && losses.hpLost + losses.tempLost > 0) {
			lines.push(...saveRequestEvents(holder as never, 'takeDamage'));
		}
	}
	if (lines.length > 0) await addCardEvents(card as never, lines);
}

/** The escape no longer stands: give back what its damage took, and take its lines off. */
export async function takeBackEscapeDamage(
	card: HostCard,
	escaped: { holderUuid: string; effectId: string },
): Promise<void> {
	const prefix = lineIdPrefix(escaped.holderUuid, escaped.effectId);
	const lines = cardEventsOf(card as never).filter(
		(event) => event.id.startsWith(prefix) && event.action?.kind === 'turnDamage',
	);
	for (const line of lines) {
		if (line.action?.kind === 'turnDamage' && line.action.state === 'dealt') {
			await undoTurnDamage(card, line);
		}
		await replaceCardEvent(card as never, line.id, null);
	}
}
