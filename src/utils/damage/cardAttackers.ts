import { type AttackActivation, type AttackDelivery, deliveryOfAttack } from './attackDelivery.js';

interface AttackerToken {
	disposition?: number;
	actor?: unknown;
}

interface MemberActor {
	uuid?: string;
	type?: string;
	items?: { get(id: string): { system?: { activation?: AttackActivation } } | undefined };
}

interface Member {
	actor?: MemberActor | null;
	token?: AttackerToken | null;
}

interface AttackCard {
	type?: string;
	speaker?: { scene?: string | null; token?: string | null } | null;
	system?: unknown;
}

/** One creature that made the card's attack, with its token and how its attack reached. */
export interface CardAttacker<A = unknown> {
	actor: A;
	token: AttackerToken | null;
	delivery: AttackDelivery;
}

function speakerToken(card: AttackCard): AttackerToken | null {
	const { scene, token } = card.speaker ?? {};
	if (!scene || !token) return null;
	return (game.scenes?.get(scene)?.tokens.get(token) ?? null) as AttackerToken | null;
}

function combatantById(id: string): Member | null {
	for (const combat of game.combats ?? []) {
		const combatant = combat.combatants?.get(id);
		if (combatant) return combatant as unknown as Member;
	}
	return null;
}

/** Each member that rolled on a minion group card, a missed one too, with its own action. */
function groupAttackers(card: AttackCard): CardAttacker[] {
	const rows = ((card.system as { rows?: unknown[] } | undefined)?.rows ?? []) as Array<{
		memberCombatantId?: string;
		actionId?: string;
	}>;
	const attackers: CardAttacker[] = [];
	for (const row of rows) {
		const member = row.memberCombatantId ? combatantById(row.memberCombatantId) : null;
		const actor = member?.actor;
		if (!actor?.uuid) continue;
		const activation = row.actionId ? actor.items?.get(row.actionId)?.system?.activation : null;
		attackers.push({
			actor,
			token: member?.token ?? null,
			delivery: deliveryOfAttack(activation, actor),
		});
	}
	return attackers;
}

/** The creatures that made the card's attack: the speaker, or each member of a minion group. */
export function cardAttackers(
	card: AttackCard,
	speaker: unknown,
	delivery: AttackDelivery,
): CardAttacker[] {
	if (card.type === 'minionGroupAttack') return groupAttackers(card);
	return speaker ? [{ actor: speaker, token: speakerToken(card), delivery }] : [];
}
