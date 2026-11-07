import { SYSTEM_ID, systemHookName } from '#system';
import { applyRecoveryToActorIfEligible } from '#utils/chargePool/chargePoolRecover.js';
import { buildEffectiveChargePoolMap } from '#utils/chargePool/helpers.js';
import type { CharacterActorLike } from '#utils/chargePool/types.js';
import { isResourceRecoveryAutomationEnabled } from '../../settings/automationSettings.js';

const RECOVERED_COMBAT_FLAG = 'initiativeRecoveryCombat';

let registered = false;

/** Actor and combat pairs refilled on this client, for two rolls that land before the flag does. */
const refilled = new Set<string>();

function combatIdOf(combatant: unknown): string | null {
	const holder = combatant as { parent?: { id?: string | null }; combat?: { id?: string | null } };
	return holder?.parent?.id ?? holder?.combat?.id ?? null;
}

function refillsOnInitiative(actor: CharacterActorLike): boolean {
	return Object.values(buildEffectiveChargePoolMap(actor)).some((pool) =>
		pool.recoveries.some((recovery) => recovery.trigger === 'onInitiativeRolled'),
	);
}

function refilledIn(actor: Actor.Implementation, combatId: string): boolean {
	const stored = foundry.utils.getProperty(actor, `flags.${SYSTEM_ID}.${RECOVERED_COMBAT_FLAG}`);
	return refilled.has(`${combatId}:${actor.uuid}`) || stored === combatId;
}

function markCombat(actor: Actor.Implementation, combatId: string | null): Promise<unknown> {
	return actor.update({
		[`flags.${SYSTEM_ID}.${RECOVERED_COMBAT_FLAG}`]: combatId,
	} as Actor.UpdateData);
}

async function refillOnce(actor: Actor.Implementation, combatId: string): Promise<void> {
	const character = actor as unknown as CharacterActorLike;
	if (!refillsOnInitiative(character) || refilledIn(actor, combatId)) return;
	const key = `${combatId}:${actor.uuid}`;
	refilled.add(key);
	try {
		await markCombat(actor, combatId);
		await applyRecoveryToActorIfEligible(character, 'onInitiativeRolled');
	} catch (error) {
		refilled.delete(key);
		console.error('Nimble | The Initiative refill failed', error);
		await markCombat(actor, null).catch(() => {});
	}
}

function isCharacter(actor: unknown): actor is Actor.Implementation {
	return Boolean(actor) && (actor as Actor.Implementation).type === 'character';
}

function onInitiativeRolled(payload: { actor?: unknown; combatant?: unknown }): void {
	const actor = payload?.actor;
	if (!isCharacter(actor) || !isResourceRecoveryAutomationEnabled()) return;

	const combatId = combatIdOf(payload.combatant);
	if (combatId) {
		void refillOnce(actor, combatId);
		return;
	}
	void applyRecoveryToActorIfEligible(actor as unknown as CharacterActorLike, 'onInitiativeRolled');
}

/**
 * A GM who types an Initiative by hand fires no roll, so that hero gets the
 * refill at the start. Foundry fires `combatStart` only on the client that
 * starts the combat.
 */
function onCombatStart(combat: Combat): void {
	if (!combat?.id || !isResourceRecoveryAutomationEnabled()) return;
	for (const combatant of combat.combatants.contents) {
		const actor = combatant.actor;
		if (combatant.initiative === null || !isCharacter(actor)) continue;
		void refillOnce(actor, combat.id);
	}
}

/**
 * Fires the `onInitiativeRolled` recovery trigger when an actor rolls
 * initiative, once per combat. Driven off `nimble.initiativeRolled`. Pools
 * that opt into recovery on this trigger (Commander Combat Dice: "When you
 * roll Initiative, gain STR Combat Dice") receive their recovery entry's
 * effect. Initiative rolled again in the same combat gives nothing. At combat
 * start, a hero with an Initiative who did not get the refill yet gets it.
 */
export function registerInitiativeTriggerHooks(): void {
	if (registered) return;
	registered = true;

	// @ts-expect-error nimble.initiativeRolled is a custom Nimble hook not in
	// Foundry's typed Hooks union; emitted by combat.svelte.ts and the actor
	// initiative-roll path, consumed here to drive onInitiativeRolled recovery.
	Hooks.on(systemHookName('initiativeRolled'), onInitiativeRolled);
	Hooks.on('combatStart', onCombatStart);
}
