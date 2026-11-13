import type { CardEvent, TempHpChoiceAction } from '#types/cardEvent.d.ts';
import { replaceCardEvent } from '#utils/chat/cardEvents.js';
import { fireEvent } from '#utils/lastsUntil/lastsUntilEvents.js';
import { clearTempHpLinks, giveTempHp } from './effectTempHp.js';

const WORDS = 'NIMBLE.chat.tempHpChoice';
const TEMP_PATH = 'system.attributes.hp.temp';

interface ChoiceHolder {
	uuid: string;
	name?: string | null;
	isOwner?: boolean;
	effects?: Iterable<{
		id?: string | null;
		system?: unknown;
		update(data: object): Promise<unknown>;
	}>;
	update(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

interface ChoiceCard {
	id?: string | null;
	flags?: Record<string, unknown>;
}

/**
 * The line that asks the owner which temp HP to keep (Core 305: temp HP do not combine). An
 * effect that gives the new amount is named, so it owns the temp HP when the owner takes it.
 */
export function tempHpChoiceEvent(
	holder: { uuid: string; name?: string | null },
	refused: { temp: number; amount: number },
	effectUuid: string | null = null,
	at = Date.now(),
): CardEvent {
	const action: TempHpChoiceAction = {
		kind: 'tempHpChoice',
		holderUuid: holder.uuid,
		holderName: holder.name ?? '',
		had: refused.temp,
		amount: refused.amount,
		effectUuid,
		state: 'waiting',
	};
	return {
		id: `tempHpChoice.${holder.uuid}.${at}`,
		kind: 'tempHpChoice',
		icon: 'fa-solid fa-shield-halved',
		text: {
			key: `${WORDS}.ask`,
			data: { name: action.holderName, had: action.had, amount: action.amount },
		},
		cause: { key: `${WORDS}.askCause` },
		action,
		at,
	};
}

function holderOf(action: TempHpChoiceAction): ChoiceHolder | null {
	return fromUuidSync(action.holderUuid as never, { strict: false }) as ChoiceHolder | null;
}

/** The owner of the creature, or a GM, makes the choice. */
export function canChooseTempHp(action: TempHpChoiceAction): boolean {
	return !!game.user?.isGM || !!holderOf(action)?.isOwner;
}

/**
 * Keep the temp HP the creature has, or take the new amount. A new amount from an effect is then
 * that effect's to take back when it ends; the temp HP of other effects are gone.
 */
export async function chooseTempHp(
	card: ChoiceCard,
	event: CardEvent,
	take: boolean,
): Promise<boolean> {
	const action = event.action as TempHpChoiceAction | undefined;
	if (action?.kind !== 'tempHpChoice' || action.state !== 'waiting' || !card.id) return false;
	const holder = holderOf(action);
	if (!holder) return false;
	if (take) {
		const effectId = action.effectUuid?.split('.').pop() ?? null;
		const unchanged = Number(foundry.utils.getProperty(holder, TEMP_PATH)) === action.amount;
		await giveTempHp(holder, action.amount, effectId);
		// The same amount makes no update, so the GM does not end the other links.
		if (unchanged) {
			const ended = await clearTempHpLinks(holder, effectId);
			for (const effect of ended) {
				if (!effect.id) continue;
				fireEvent('tempHpGone', holder, { effectIds: [effect.id], effect: effect.name ?? '' });
			}
		}
		const gave = action.effectUuid
			? (fromUuidSync(action.effectUuid as never, { strict: false }) as {
					update(data: object): Promise<unknown>;
				} | null)
			: null;
		await gave?.update({ 'system.tempHp': action.amount });
	}
	const kept = take ? action.amount : action.had;
	return replaceCardEvent(card as never, event.id, {
		...event,
		text: { key: `${WORDS}.chose`, data: { name: action.holderName, amount: kept } },
		cause: { key: `${WORDS}.choseCause` },
		action: { ...action, state: take ? 'took' : 'kept' },
	});
}
