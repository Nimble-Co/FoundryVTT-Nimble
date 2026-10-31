import { SYSTEM_ID } from '#system';
import type { EffectNode } from '#types/effectTree.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

/** Rushed Attacks (Core Rules): each attack after the first on a turn adds 1 disadvantage. */
const FLAG = 'attacksThisTurn';
const SAVE_NODE = 'savingThrow';

interface AttackCount {
	round: number;
	turn: number;
	count: number;
}

interface CombatLike {
	started?: boolean;
	round: number;
	turn: number | null;
	combatant?: {
		actorId?: string | null;
		getFlag(scope: string, key: string): unknown;
		setFlag(scope: string, key: string, value: AttackCount): Promise<unknown>;
	} | null;
}

interface ActorLike {
	id: string | null;
}

interface ItemLike {
	type?: string;
	system?: unknown;
}

function effectTypes(item: ItemLike): Set<string> {
	const { activation } = (item.system ?? {}) as { activation?: { effects?: EffectNode[] } };
	return new Set(flattenEffectsTree(activation?.effects ?? []).map((node) => node.type));
}

/** The glossary: an attack is any offensive action, so a weapon, or a spell that does damage. */
export function countsAsAttack(item: ItemLike | null | undefined): boolean {
	if (!item) return false;
	if (item.type === 'spell') return effectTypes(item).has('damage');
	const { activation } = (item.system ?? {}) as {
		activation?: { targets?: { attackType?: string } };
	};
	return !!activation?.targets?.attackType;
}

/** A roll by the attacker takes the disadvantage. With a save, the rule gives the enemy advantage. */
export function rollsWithRushedDisadvantage(item: ItemLike | null | undefined): boolean {
	return countsAsAttack(item) && !effectTypes(item as ItemLike).has(SAVE_NODE);
}

function ownTurn(actor: ActorLike, combat: CombatLike | null | undefined) {
	if (!combat?.started || combat.combatant?.actorId !== actor.id) return null;
	return combat.combatant;
}

/** The attacks that the actor made on this turn. The count holds its turn, so a new turn starts at 0. */
export function attacksMadeThisTurn(
	actor: ActorLike,
	combat: CombatLike | null | undefined = game.combat as unknown as CombatLike,
): number {
	const combatant = ownTurn(actor, combat);
	if (!combatant || !combat) return 0;
	const saved = combatant.getFlag(SYSTEM_ID, FLAG) as AttackCount | undefined;
	return saved?.round === combat.round && saved.turn === combat.turn ? saved.count : 0;
}

export async function recordAttack(
	actor: ActorLike,
	combat: CombatLike | null | undefined = game.combat as unknown as CombatLike,
): Promise<void> {
	const combatant = ownTurn(actor, combat);
	if (!combatant || !combat) return;
	await combatant.setFlag(SYSTEM_ID, FLAG, {
		round: combat.round,
		turn: combat.turn ?? 0,
		count: attacksMadeThisTurn(actor, combat) + 1,
	});
}
