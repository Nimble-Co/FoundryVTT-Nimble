import { SYSTEM_ID } from '#system';
import { rulesOfType } from '#utils/actor/actorRules.js';
import { applyEffectToActor, payloadFromEffect } from '#utils/actor/applyEffectToActor.js';
import { areAllies } from '#utils/movement/alliesWithin.js';
import { pendingKeepOf } from '#utils/rolls/cardRollState.js';
import { DamageRoll } from '../dice/DamageRoll.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

const ACTIVATION_CARD_TYPES = new Set(['feature', 'spell', 'object']);

interface ItemEffect {
	transfer?: boolean;
	toObject(): Record<string, unknown>;
}

interface UsedItem {
	uuid?: string | null;
	actor?: unknown;
	system?: { identifier?: string };
	effects?: Iterable<ItemEffect>;
}

interface SideToken {
	disposition?: number;
	actor?: unknown;
}

interface ActivationCard {
	type?: string;
	speaker?: { scene?: string | null; token?: string | null };
	flags?: Record<string, Record<string, unknown> | undefined>;
	system?: { isMiss?: boolean; targets?: string[]; pendingKeep?: unknown };
	rolls?: unknown[];
	update(data: Record<string, unknown>): Promise<unknown>;
}

/** The effect the item gives: its first effect that stays on the item. */
function itemEffectOf(item: UsedItem | null | undefined): ItemEffect | null {
	return [...(item?.effects ?? [])].find((effect) => effect.transfer === false) ?? null;
}

function cardItem(card: ActivationCard): UsedItem | null {
	const uuid = card.flags?.[SYSTEM_ID]?.itemUuid;
	if (typeof uuid !== 'string') return null;
	return (fromUuidSync(uuid as never, { strict: false }) as UsedItem | null) ?? null;
}

/** The Primary Die face before any bonus, from the card's attack roll. */
function primaryDieFace(card: ActivationCard): number | null {
	const roll = (card.rolls ?? []).find((entry) => entry instanceof DamageRoll) as
		| DamageRoll
		| undefined;
	if (!roll) return null;
	const face = roll.options.primaryDieBaseResult ?? roll.primaryDieValue;
	return typeof face === 'number' ? face : null;
}

/** The card's target tokens, one for each actor. */
function targetTokens(card: ActivationCard): SideToken[] {
	const byActor = new Map<unknown, SideToken>();
	for (const uuid of card.system?.targets ?? []) {
		const token = fromUuidSync(uuid as never, { strict: false }) as SideToken | null;
		if (token?.actor && !byActor.has(token.actor)) byActor.set(token.actor, token);
	}
	return [...byActor.values()];
}

/** The side of the user: the card speaker's token, else the actor's prototype token. */
function userSide(card: ActivationCard, user: unknown): SideToken | null {
	const { scene, token } = card.speaker ?? {};
	const spoken = scene && token ? game.scenes?.get(scene)?.tokens.get(token) : null;
	if (spoken) return spoken as unknown as SideToken;
	return ((user as { prototypeToken?: SideToken } | null)?.prototypeToken ??
		null) as SideToken | null;
}

/** Each target of the card gets the effect of every rule that the Primary Die face meets. */
export async function applyDieResultEffects(card: ActivationCard): Promise<void> {
	if (!ACTIVATION_CARD_TYPES.has(card.type ?? '') || !isRuleAutomationEnabled()) return;
	if (card.system?.isMiss === true || pendingKeepOf(card.system)) return;

	const used = cardItem(card);
	const user = used?.actor as
		| (NonNullable<Parameters<typeof payloadFromEffect>[1]['user']> & { rules?: unknown })
		| undefined;
	if (!used || !user) return;
	const rules = rulesOfType(user, 'dieResultEffect').filter(
		(rule) => rule.isLive() && rule.readsUseOf(used),
	);
	if (rules.length === 0) return;

	const face = primaryDieFace(card);
	if (face === null) return;
	const tokens = targetTokens(card);
	if (tokens.length === 0) return;
	const side = userSide(card, user);

	for (const rule of rules) {
		if (face < rule.atLeast) continue;
		const targets = tokens
			.filter((token) => !rule.notOnAllies || !side || !areAllies(side as never, token as never))
			.map((token) => token.actor as Parameters<typeof applyEffectToActor>[0]);
		if (targets.length === 0) continue;
		const item = rule.item as UsedItem | null;
		const effect = itemEffectOf(item);
		if (!item?.uuid || !effect) continue;
		const payload = payloadFromEffect(effect, { itemUuid: item.uuid, user });
		const results = await Promise.allSettled(
			targets.map((target) => applyEffectToActor(target, payload)),
		);
		for (const result of results) {
			if (result.status === 'rejected') console.error(result.reason);
		}
	}
}

let registered = false;

/** The client that made the card applies the effects; a target it does not own goes to the GM. */
export function registerDieResultEffectHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on('createChatMessage', ((card: ActivationCard, _options: unknown, userId: string) => {
		if (userId !== game.user?.id) return;
		void applyDieResultEffects(card).catch((error) => {
			console.error('Nimble | Could not apply the effect of a die result.', error);
		});
	}) as never);
}
