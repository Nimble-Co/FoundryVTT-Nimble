import { requestCombatantActionDelta } from '#utils/combat/requestCombatantActionDelta.js';
import type { RerollGrant } from '#utils/incomingReactions/incomingReactionEntry.js';
import { grantModifiers, type ModifierOwner } from '#utils/reroll/modifyReroll.js';
import { rollerTokenOf } from '#utils/reroll/rerollAllies.js';
import type { RerollingActor, RerollRuleLike } from '#utils/reroll/rerollEntries.js';
import { type ActionState, rerollGrants } from '#utils/reroll/rerollGrants.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { tempHpChoiceEvent } from '../actor/tempHpChoice.js';
import { activationEventsOf } from '../chat/activationEvents.js';
import { addCardEvents } from '../chat/cardEvents.js';

interface CombatantLike {
	id?: string | null;
	type?: string;
}

function combatantOf(actorUuid: string): { combat: Combat; combatant: CombatantLike } | null {
	const combat = game.combat as (Combat & { started?: boolean }) | null | undefined;
	if (!combat?.started) return null;
	const actor = fromUuidSync(actorUuid as `Actor.${string}`) as Actor.Implementation | null;
	if (!actor) return null;
	const [combatant] = combat.getCombatantsByActor(actor) as unknown as CombatantLike[];
	return combatant ? { combat, combatant } : null;
}

function actionState(actor: { uuid: string }): ActionState {
	const found = combatantOf(actor.uuid);
	if (!found) return 'notInCombat';
	return found.combatant.type === 'character' ? 'ok' : 'notACharacter';
}

/** What creatures get from one use of `rule`, rolled by `roller`. */
async function grantsForUse(
	rule: RerollRuleLike,
	roller: RerollingActor | null | undefined,
): Promise<RerollGrant[]> {
	const owner = rule.actor as (ModifierOwner & { uuid: string }) | null | undefined;
	const modifiers = await grantModifiers({ identifier: rule.identifier, actor: owner });
	if (modifiers.length < 1) return [];
	return rerollGrants({
		modifiers,
		rollerActor: (roller as Parameters<typeof rerollGrants>[0]['rollerActor']) ?? null,
		rollerToken: rollerTokenOf(roller),
		ownerActor: owner ?? null,
		ownerToken: rollerTokenOf(owner),
		actionState,
		featureEffects: isRuleAutomationEnabled(),
	});
}

/** Where the temp HP choice of a creature that has more goes: the card, or the roller's use. */
interface GrantHost {
	card?: { id?: string | null } | null;
	roller?: { uuid?: string | null } | null;
}

async function askTempHpChoices(grants: readonly RerollGrant[], host: GrantHost): Promise<void> {
	const lines = grants.flatMap((grant) =>
		grant.applied && grant.tempHp && grant.tempHp.keeps !== null
			? [
					tempHpChoiceEvent(
						{ uuid: grant.actorUuid, name: grant.name },
						{ temp: grant.tempHp.had, amount: grant.tempHp.amount },
					),
				]
			: [],
	);
	if (lines.length < 1) return;
	if (host.card?.id) await addCardEvents(host.card as never, lines);
	else await activationEventsOf(host.roller as never)?.add(lines);
}

/** Give creatures what a use of a reroll gave them. A failure is logged, not thrown. */
async function applyGrants(
	grants: readonly RerollGrant[],
	sourceItemUuid: string,
	host: GrantHost = {},
): Promise<void> {
	await askTempHpChoices(grants, host).catch((error) =>
		console.error('Nimble | Could not ask which temp HP to keep.', error),
	);
	for (const grant of grants) {
		if (!grant.applied) continue;
		try {
			const actor = fromUuidSync(grant.actorUuid as `Actor.${string}`) as {
				applyHealing?: (amount: number, type: string) => Promise<void>;
			} | null;
			if (grant.tempHp && grant.tempHp.keeps === null) {
				await actor?.applyHealing?.(grant.tempHp.amount, 'tempHealing');
			}
			const found = combatantOf(grant.actorUuid);
			if (grant.actions && grant.actions.amount > 0 && found?.combatant.id) {
				await requestCombatantActionDelta({
					combat: found.combat,
					combatantId: found.combatant.id,
					sourceItemUuid,
					deltas: { currentDelta: grant.actions.amount, pendingDelta: 0 },
				});
			}
		} catch (error) {
			console.error('Nimble | Could not give what a reroll gave.', error);
		}
	}
}

export { applyGrants, grantsForUse };
