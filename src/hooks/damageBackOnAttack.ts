import type { AttackedCreature, CardDamageBack } from '#documents/chatMessage/cardDamageBack.js';
import { SYSTEM_ID } from '#system';
import { effectCardIdOf } from '#utils/damage/damageCard.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { isAttackUse } from '#utils/lastsUntil/lastsUntilEvents.js';

const ITEM_CARD_TYPES = new Set(['feature', 'spell', 'object', 'reaction']);

/** The card flag of a use that answers an attack: the attack card's id. */
export const ANSWERS_CARD_FLAG = 'answersCardId';

interface TargetToken {
	uuid?: string;
	actor?: AttackedCreature['actor'] | null;
}

interface AttackCard {
	id?: string | null;
	type?: string;
	flags?: Record<string, Record<string, unknown> | undefined>;
	system?: { targets?: string[] };
	cardDamageBack?: CardDamageBack;
}

/** The creatures the card attacks, one for each actor, with the token the card names. */
function attackedOn(card: AttackCard): AttackedCreature[] {
	const byActor = new Map<unknown, AttackedCreature>();
	for (const uuid of card.system?.targets ?? []) {
		const token = fromUuidSync(uuid as never, { strict: false }) as TargetToken | null;
		if (token?.actor && !byActor.has(token.actor)) {
			byActor.set(token.actor, { actor: token.actor, token: token as never });
		}
	}
	return [...byActor.values()];
}

function isAttackCard(card: AttackCard, attacked: readonly AttackedCreature[]): boolean {
	if (card.type === 'minionGroupAttack') return true;
	if (!ITEM_CARD_TYPES.has(card.type ?? '')) return false;
	const uuid = card.flags?.[SYSTEM_ID]?.itemUuid;
	const item = (
		typeof uuid === 'string' ? fromUuidSync(uuid as never, { strict: false }) : null
	) as {
		actor?: object | null;
	} | null;
	if (!item) return false;
	// The card's activation, as the use made it.
	const used = { actor: item.actor ?? null, system: card.system };
	return isAttackUse(
		used,
		attacked.map((each) => each.actor as object),
	);
}

/** The creatures an attack card attacks give their Attacked rules to its attackers. */
export async function answerAttackCard(card: AttackCard): Promise<void> {
	if (!isActiveGM() || !card.cardDamageBack) return;
	const attacked = attackedOn(card);
	if (attacked.length < 1 || !isAttackCard(card, attacked)) return;
	await card.cardDamageBack.afterAttack(attacked);
}

interface NewEffect {
	id?: string | null;
	parent?: unknown;
}

/**
 * An effect from a use that answers an attack (a reaction from the Defend window) also covers
 * that attack, for its rules that say so.
 */
export async function answerAttackOfEffect(effect: NewEffect, options: unknown): Promise<void> {
	if (!isActiveGM() || !effect.id || !(effect.parent instanceof Actor)) return;
	const useCardId = effectCardIdOf(options);
	const useCard = useCardId ? (game.messages?.get(useCardId) as AttackCard | undefined) : null;
	const attackCardId = useCard?.flags?.[SYSTEM_ID]?.[ANSWERS_CARD_FLAG];
	if (typeof attackCardId !== 'string') return;
	const attackCard = game.messages?.get(attackCardId) as AttackCard | undefined;
	if (!attackCard?.cardDamageBack) return;
	const holder = effect.parent as unknown as AttackedCreature['actor'];
	const named = attackedOn(attackCard).find((each) => each.actor === holder);
	await attackCard.cardDamageBack.afterAttack([named ?? { actor: holder }], {
		effectId: effect.id,
	});
}

let registered = false;

export function registerDamageBackOnAttackHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on('createChatMessage', (card: unknown) => {
		void answerAttackCard(card as AttackCard).catch((error) => {
			console.error('Nimble | Could not read the attack for Attacker Takes.', error);
		});
	});
	Hooks.on('createActiveEffect', (effect: unknown, options: unknown) => {
		void answerAttackOfEffect(effect as NewEffect, options).catch((error) => {
			console.error('Nimble | Could not read the answered attack for Attacker Takes.', error);
		});
	});
}
