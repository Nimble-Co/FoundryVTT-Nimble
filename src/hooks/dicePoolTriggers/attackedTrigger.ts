import { SYSTEM_ID, systemHookName } from '#system';
import type { EffectNode } from '#types/effectTree.js';
import { findPrimaryDamageNode } from '#utils/damage/foldBonusIntoPrimaryDamage.js';
import { applyRefillToActorIfEligible } from '#utils/dicePool/dicePoolRefill.js';
import type { CharacterActorLike } from '#utils/dicePool/types.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { firesCritTriggers } from '#utils/reroll/firesCritTriggers.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { raisePoolDiceOnAttacked } from './poolDieToMaxTrigger.js';

const ATTACKED_FLAG = 'attackedActors';

interface AttackCard {
	id?: string | null;
	type?: string;
	speaker?: { actor?: string | null };
	system?: { targets?: string[]; activation?: { effects?: unknown[] } };
	getFlag?(scope: string, key: string): unknown;
	setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
}

function isAttackCard(card: AttackCard): boolean {
	if (card.type === 'minionGroupAttack') return true;
	const effects = (card.system?.activation?.effects ?? []) as EffectNode[];
	return !!findPrimaryDamageNode(flattenEffectsTree(effects));
}

function targetActors(card: AttackCard): Actor.Implementation[] {
	const actors = (card.system?.targets ?? []).map(
		(uuid) => (fromUuidSync(uuid) as TokenDocument | null)?.actor as Actor.Implementation | null,
	);
	return [...new Set(actors)].filter(
		(actor): actor is Actor.Implementation => !!actor && actor.id !== card.speaker?.actor,
	);
}

const attackedOn = (card: AttackCard) =>
	card.getFlag?.(SYSTEM_ID, ATTACKED_FLAG) as string[] | undefined;

function onAttacked(actor: Actor.Implementation): void {
	if (actor.type !== 'character') return;
	void applyRefillToActorIfEligible(actor as CharacterActorLike, 'onAttacked').then(() =>
		raisePoolDiceOnAttacked(actor as never),
	);
}

const firing = new Set<string>();

/**
 * Fires `onAttacked` once per creature for the targets of an attack card, also
 * on a miss. The card keeps the creatures it fired for, so a reroll or the
 * damage of the card does not fire again. An update of a card with no record
 * is a card older than this event.
 */
async function fireFromCard(card: AttackCard, created: boolean): Promise<void> {
	if (!isActiveGM() || !isAttackCard(card)) return;
	const fired = attackedOn(card);
	if (!created && !fired) return;
	const cardId = card.id ?? '';
	if (firing.has(cardId)) return;

	const actors = targetActors(card).filter((actor) => !fired?.includes(actor.uuid as string));
	if (fired && actors.length < 1) return;
	firing.add(cardId);
	try {
		await card.setFlag?.(SYSTEM_ID, ATTACKED_FLAG, [
			...(fired ?? []),
			...actors.map((actor) => actor.uuid),
		]);
		for (const actor of actors) onAttacked(actor);
	} catch (error) {
		console.error('Nimble | The attacked trigger of a card failed.', error);
	} finally {
		firing.delete(cardId);
	}
}

/** Damage of a card with a record fires only for a creature the card did not fire for. */
function fireFromDamage(actor: Actor.Implementation, card: AttackCard | undefined): void {
	const fired = card ? attackedOn(card) : undefined;
	if (fired?.includes(actor.uuid as string)) return;
	if (fired) void card?.setFlag?.(SYSTEM_ID, ATTACKED_FLAG, [...fired, actor.uuid]);
	onAttacked(actor);
}

let registered = false;

/**
 * Fires the `onAttacked` refill trigger for each character an attack targets,
 * hit or miss, and for each character that takes damage from a card that did
 * not target it. Pools that opt into refilling on this trigger (Oathsworn
 * Judgment Dice: "Whenever an enemy attacks you, if you have no Judgment Dice,
 * roll your Judgment dice (2d6)") receive their refill entry's effect; pools
 * that don't opt in are untouched.
 */
export function registerAttackedTriggerHooks(): void {
	if (registered) return;
	registered = true;

	Hooks.on('createChatMessage', (card: unknown) => {
		void fireFromCard(card as AttackCard, true);
	});
	Hooks.on('updateChatMessage', (card: unknown) => {
		void fireFromCard(card as AttackCard, false);
	});

	const handleDamageApplied = (payload: {
		targetActor?: unknown;
		card?: unknown;
		isCritical?: boolean;
		discardedCritTriggers?: boolean;
		discardedCritTriggersFired?: boolean;
	}) => {
		const target = payload?.targetActor;
		if (!target || typeof target !== 'object') return;
		const actor = target as Actor.Implementation;
		if (actor.type !== 'character') return;

		fireFromDamage(actor, payload.card as AttackCard | undefined);

		// Only crits that reach damage application register — an attack that
		// never applies damage does not fire this trigger.
		const critTriggers = {
			isCritical: payload?.isCritical,
			discardedCritTriggers:
				payload?.discardedCritTriggers === true && payload.discardedCritTriggersFired !== true,
		};
		if (firesCritTriggers(critTriggers)) {
			void applyRefillToActorIfEligible(actor as CharacterActorLike, 'onCritReceived');
		}
	};

	// A kept discarded crit that ends in a miss applies no damage, so its
	// crit refill fires from its own hook.
	const handleDiscardedCritTriggered = (payload: { targetActor?: unknown }) => {
		const target = payload?.targetActor;
		if (!target || typeof target !== 'object') return;
		const actor = target as Actor.Implementation;
		if (actor.type !== 'character') return;
		void applyRefillToActorIfEligible(actor as CharacterActorLike, 'onCritReceived');
	};

	// @ts-expect-error nimble.damageApplied is a custom Nimble hook not in
	// Foundry's typed Hooks union; emitted by the damage application pipeline
	// once per affected target, consumed here to drive onAttacked refill.
	Hooks.on(systemHookName('damageApplied'), handleDamageApplied);
	// @ts-expect-error nimble.discardedCritTriggered is a custom Nimble hook
	// emitted once per target by the discarded-crit trigger hooks.
	Hooks.on(systemHookName('discardedCritTriggered'), handleDiscardedCritTriggered);
}
