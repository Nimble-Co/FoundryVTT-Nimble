import type { CardEvent, CardEventText, ZeroHpAction } from '#types/cardEvent.d.ts';
import { ACTOR_HP_PATHS, undoDamageOption } from '#utils/actor/actorHpChangePaths.js';
import { replacedWithoutEnd } from '#utils/actor/applyConditionToActor.js';
import { UNDO_APPLICATION_OPTION } from '#utils/actor/effectStacks.js';
import { addMomentEvents, replaceCardEvent } from '#utils/chat/cardEvents.js';
import { mayActHere } from '#utils/chat/cardOperations.js';
import { END_LINES_OPTION } from '#utils/dicePool/emptyPoolLine.js';
import { rulesOfEffect } from '#utils/documents/rulesOfEffect.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';

const WORDS = 'NIMBLE.chat.zeroHpAtEnd';

interface ZeroHpRule {
	type?: string;
	disabled?: boolean;
	appliesTo?(): boolean;
}

/** An effect as it ends: its prepared rules, else its rule data, and its holder. */
export interface ZeroHpEffect {
	id?: string | null;
	name?: string | null;
	img?: string | null;
	statuses?: ReadonlySet<string> | null;
	parent?: unknown;
	rules?: unknown;
	system?: unknown;
}

interface ZeroHpHolder {
	uuid: string;
	name?: string | null;
	system?: unknown;
	update(data: Record<string, unknown>, options?: object): Promise<unknown>;
}

interface LineCard {
	id?: string | null;
	flags?: Record<string, unknown>;
}

/** Whether the effect has a 0 HP at End rule that is on: its prepared rules, else its rule data. */
export function dropsToZeroAtEnd(effect: ZeroHpEffect): boolean {
	return rulesOfEffect<ZeroHpRule>(effect).some(
		(rule) =>
			rule?.type === 'zeroHpAtEnd' &&
			!rule.disabled &&
			(typeof rule.appliesTo !== 'function' || rule.appliesTo()),
	);
}

function hpOf(holder: ZeroHpHolder): { value: number; max: number } {
	const read = (path: string) => Number(foundry.utils.getProperty(holder, path)) || 0;
	return { value: read(ACTOR_HP_PATHS.value), max: read(ACTOR_HP_PATHS.max) };
}

/** Sets the HP to 0 and says how many it took. */
async function dropToZero(holder: ZeroHpHolder): Promise<number> {
	const { value } = hpOf(holder);
	if (value <= 0) return 0;
	await holder.update({ [ACTOR_HP_PATHS.value]: 0 });
	return value;
}

function lineOf(action: ZeroHpAction, img: string | null | undefined, at: number): CardEvent {
	return {
		id: `zeroHp.${action.holderUuid}.${at}`,
		kind: 'healthState',
		...(img ? { img } : { icon: 'fa-solid fa-heart-crack' }),
		text: { key: `${WORDS}.drops`, data: { name: action.holderName } },
		cause: { key: `${WORDS}.cause`, data: { effect: action.effectName } },
		action,
		at,
	};
}

/**
 * On the active GM, after the effects ended: each holder with a 0 HP at End rule on an ended effect
 * drops to 0 HP, with a line and Undo. With Feature Effects off, the line waits for a click. A
 * holder at 0 HP already gets no line.
 */
export async function zeroHpAtEndEvents(
	effects: readonly ZeroHpEffect[],
	at: number,
): Promise<CardEvent[]> {
	const lines: CardEvent[] = [];
	for (const effect of effects) {
		if (!dropsToZeroAtEnd(effect) || !(effect.parent instanceof Actor)) continue;
		const holder = effect.parent as unknown as ZeroHpHolder;
		if (hpOf(holder).value <= 0) continue;
		const action: ZeroHpAction = {
			kind: 'zeroHp',
			holderUuid: holder.uuid,
			holderName: holder.name ?? '',
			effectName: effect.name ?? '',
			state: 'waiting',
		};
		if (isRuleAutomationEnabled()) {
			action.hpLost = await dropToZero(holder);
			action.state = 'dropped';
		}
		lines.push(lineOf(action, effect.img, at));
	}
	return lines;
}

/**
 * Call on the active GM. An end with no line of its own (a removal by hand, a deleted origin item):
 * the drop and its line go on a card of their own. A copy that replaces the effect, or an undo of its
 * application, is not an end; a replaced Concentration is.
 */
export async function dropToZeroOnDelete(
	effect: ZeroHpEffect,
	options: Record<string, unknown> | undefined,
	heading: CardEventText,
): Promise<void> {
	if (options?.[END_LINES_OPTION] || options?.[UNDO_APPLICATION_OPTION]) return;
	if (replacedWithoutEnd(effect, options)) return;
	try {
		const lines = await zeroHpAtEndEvents([effect], Date.now());
		if (lines.length < 1) return;
		await addMomentEvents({ key: `once:${foundry.utils.randomID()}`, heading }, lines);
	} catch (error) {
		console.error('Nimble | Could not drop the holder of an ended effect to 0 HP.', error);
	}
}

/** The owner of the holder, or a GM, drops a waiting line or undoes a dropped one. */
export function canActOnZeroHp(action: ZeroHpAction): boolean {
	return mayActHere(action.holderUuid);
}

/** A click on the line: a waiting line drops the HP to 0, a dropped one gives them back. */
export async function actOnZeroHp(card: LineCard, event: CardEvent): Promise<boolean> {
	const action = event.action as ZeroHpAction | undefined;
	if (action?.kind !== 'zeroHp' || !card.id) return false;
	if (action.state === 'undone') return false;
	const holder = fromUuidSync(action.holderUuid as never, {
		strict: false,
	}) as ZeroHpHolder | null;
	if (!holder) return false;
	if (action.state === 'waiting') {
		const hpLost = await dropToZero(holder);
		return replaceCardEvent(card as never, event.id, {
			...event,
			action: { ...action, state: 'dropped', hpLost },
		});
	}
	if (action.hpLost) {
		const { value, max } = hpOf(holder);
		await holder.update(
			{ [ACTOR_HP_PATHS.value]: Math.min(max, value + action.hpLost) },
			undoDamageOption(),
		);
	}
	return replaceCardEvent(card as never, event.id, {
		...event,
		action: { ...action, state: 'undone' },
	});
}
