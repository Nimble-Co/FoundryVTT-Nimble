import { SYSTEM_ID, systemHookName } from '#system';
import { isActiveGM } from '../utils/isActiveGM.js';

/** The card fields that decide whether a discarded crit still owes its targets the crit triggers. */
interface DiscardedCritCardSystem {
	targets?: string[];
	isCritical?: boolean;
	isMiss?: boolean;
	discardedCritTriggers?: boolean;
	discardedCritTriggersFired?: boolean;
}

interface DiscardedCritCard {
	id?: string | null;
	system?: DiscardedCritCardSystem;
	speaker?: { actor?: string | null };
	flags?: Record<string, Record<string, unknown> | undefined>;
	update: (changes: Record<string, unknown>) => Promise<unknown>;
}

/** Payload of the `discardedCritTriggered` hook, once per target. */
interface DiscardedCritTriggeredPayload {
	sourceItem: Item | null;
	sourceActor: Actor | null;
	targetActor: Actor;
	card: DiscardedCritCard;
	isCritical: boolean;
	isMiss: boolean;
}

/**
 * A reroll discarded a crit with the triggers kept, and the roll that stands
 * misses. No damage applies, so the targets' crit triggers fire from here.
 * A roll that hits fires them when its damage applies.
 */
function owesTargetCritTriggers(system: DiscardedCritCardSystem | undefined): boolean {
	return (
		system?.discardedCritTriggers === true &&
		system.discardedCritTriggersFired !== true &&
		system.isMiss === true
	);
}

function targetActorsOf(system: DiscardedCritCardSystem): Actor[] {
	const actors = new Set<Actor>();
	for (const uuid of system.targets ?? []) {
		const token = fromUuidSync(uuid) as TokenDocument | null;
		if (token?.actor) actors.add(token.actor as Actor);
	}
	return [...actors];
}

const firing = new Set<string>();

async function fireDiscardedCritTriggers(card: DiscardedCritCard): Promise<void> {
	if (!isActiveGM()) return;
	const system = card.system;
	if (!system || !owesTargetCritTriggers(system)) return;
	const cardId = card.id ?? null;
	if (!cardId || firing.has(cardId)) return;

	firing.add(cardId);
	try {
		const sourceActorId = card.speaker?.actor;
		const sourceActor = sourceActorId ? (game.actors?.get(sourceActorId) ?? null) : null;
		const sourceItemId = card.flags?.[SYSTEM_ID]?.itemId;
		const sourceItem =
			typeof sourceItemId === 'string' ? (sourceActor?.items?.get(sourceItemId) ?? null) : null;

		for (const targetActor of targetActorsOf(system)) {
			const payload: DiscardedCritTriggeredPayload = {
				sourceItem: sourceItem as Item | null,
				sourceActor: sourceActor as Actor | null,
				targetActor,
				card,
				isCritical: system.isCritical === true,
				isMiss: system.isMiss === true,
			};
			// @ts-expect-error - nimble.discardedCritTriggered is a custom Nimble hook
			Hooks.callAll(systemHookName('discardedCritTriggered'), payload);
		}
		await card.update({ 'system.discardedCritTriggersFired': true });
	} catch (error) {
		console.error('Nimble | The crit triggers of a discarded crit failed.', error);
	} finally {
		firing.delete(cardId);
	}
}

let didRegister = false;

/**
 * Fires the targets' crit triggers once per card when a kept discarded crit
 * ends in a miss, from either reroll path: the automatic reroll made with the
 * card or a reroll on the card. Runs on the active GM, who can update the
 * targets.
 */
export function registerDiscardedCritTriggerHooks(): void {
	if (didRegister) return;
	didRegister = true;
	const onCard = (card: unknown) => {
		void fireDiscardedCritTriggers(card as DiscardedCritCard);
	};
	Hooks.on('createChatMessage', onCard);
	Hooks.on('updateChatMessage', onCard);
}

export type { DiscardedCritTriggeredPayload };
