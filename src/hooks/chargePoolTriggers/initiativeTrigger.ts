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

function onInitiativeRolled(payload: { actor?: unknown; combatant?: unknown }): void {
	const actor = payload?.actor;
	if (!actor || typeof actor !== 'object') return;
	const typedActor = actor as Actor.Implementation;
	if (typedActor.type !== 'character' || !isResourceRecoveryAutomationEnabled()) return;
	const character = typedActor as unknown as CharacterActorLike;

	const combatId = combatIdOf(payload.combatant);
	if (combatId && refillsOnInitiative(character)) {
		const key = `${combatId}:${typedActor.uuid}`;
		const stored = foundry.utils.getProperty(
			typedActor,
			`flags.${SYSTEM_ID}.${RECOVERED_COMBAT_FLAG}`,
		);
		if (refilled.has(key) || stored === combatId) return;
		refilled.add(key);
		void typedActor.update({
			[`flags.${SYSTEM_ID}.${RECOVERED_COMBAT_FLAG}`]: combatId,
		} as Actor.UpdateData);
	}

	void applyRecoveryToActorIfEligible(character, 'onInitiativeRolled');
}

/**
 * Fires the `onInitiativeRolled` recovery trigger when an actor rolls
 * initiative, once per combat. Driven off `nimble.initiativeRolled`. Pools
 * that opt into recovery on this trigger (Commander Combat Dice: "When you
 * roll Initiative, gain STR Combat Dice") receive their recovery entry's
 * effect. Initiative rolled again in the same combat gives nothing.
 */
export function registerInitiativeTriggerHooks(): void {
	if (registered) return;
	registered = true;

	// @ts-expect-error nimble.initiativeRolled is a custom Nimble hook not in
	// Foundry's typed Hooks union; emitted by combat.svelte.ts and the actor
	// initiative-roll path, consumed here to drive onInitiativeRolled recovery.
	Hooks.on(systemHookName('initiativeRolled'), onInitiativeRolled);
}
