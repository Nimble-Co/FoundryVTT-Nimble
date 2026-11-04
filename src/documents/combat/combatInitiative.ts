import { getInitiativeStartingActions } from '../../utils/combat/initiativeStartingActions.js';
import { keptD20 } from '../../utils/reroll/checkRollOfCard.js';
import { initiativeCardData } from '../../utils/rolls/initiativeCard.js';
import toMessageMode from '../../utils/rolls/toMessageMode.js';
import { getCombatantPendingActionDelta } from './combatantSystem.js';
import type { InitiativeRollOutcome } from './combatTypes.js';
import { handleInitiativeRules } from './handleInitiativeRules.js';

export function applyCharacterInitiativeActionUpdate(
	combatant: Combatant.Implementation,
	combatantUpdates: Record<string, unknown>,
	rollTotal: number,
	naturalD20: number | null = null,
): void {
	if (combatant.type !== 'character') return;

	// The initiative roll only sets the character's starting actions for the
	// first round. Their max stays at 3 — per-turn restoration always refills
	// to max (reduced only by the Dying condition), so we must not touch max
	// here or low-initiative heroes would be permanently capped below 3.
	//
	// The round-1 seed is a `current`-reset site like the per-turn refill, so
	// any pending action adjustment folds in here too (and is cleared) — else a
	// pre-roll grant or debt would be silently eaten by the absolute set.
	const actionPath = 'system.actions.base.current';
	const pendingDelta = getCombatantPendingActionDelta(combatant);
	combatantUpdates[actionPath] = Math.max(
		0,
		getInitiativeStartingActions(rollTotal, naturalD20) + pendingDelta,
	);
	if (pendingDelta !== 0) {
		combatantUpdates['system.actions.pendingDelta'] = 0;
	}
}

export async function buildInitiativeChatData(params: {
	combatant: Combatant.Implementation;
	roll: Roll;
	messageOptions: ChatMessage.CreateData;
	rollIndex: number;
	combatId: string | null;
	foldedActionDelta: number;
}): Promise<ChatMessage.CreateData> {
	// A rollMode entry in messageOptions is a visibility request, not message
	// data: pull it out so it doesn't leak into the created message.
	const { rollMode: requestedRollMode, ...messageOptions } =
		params.messageOptions as ChatMessage.CreateData & { rollMode?: string | null };
	const messageData = foundry.utils.mergeObject(
		{
			speaker: ChatMessage.getSpeaker({
				actor: params.combatant.actor,
				token: params.combatant.token,
				alias: params.combatant.name ?? undefined,
			}),
			flavor: game.i18n.format('COMBAT.RollsInitiative', { name: params.combatant.name ?? '' }),
			flags: { 'core.initiativeRoll': true },
		},
		messageOptions,
	) as ChatMessage.CreateData;

	// Private rolls for hidden combatants unless an alternative mode was
	// requested; otherwise defer to the user's core.messageMode setting.
	const messageMode =
		'rollMode' in (params.messageOptions as object)
			? toMessageMode(requestedRollMode)
			: params.combatant.hidden
				? 'gm'
				: undefined;

	const chatData = (await params.roll.toMessage(messageData, {
		messageMode,
		create: false,
	})) as ChatMessage.CreateData & { sound?: string | null };

	Object.assign(
		chatData,
		await initiativeCardData({
			actor: params.combatant.actor,
			actorName: params.combatant.name ?? params.combatant.actor?.name ?? '',
			roll: params.roll,
			combatId: params.combatId,
			combatantId: params.combatant.id,
			foldedActionDelta: params.foldedActionDelta,
		}),
	);

	// Play 1 sound for the whole rolled set.
	if (params.rollIndex > 0) chatData.sound = null;
	return chatData;
}

export async function rollInitiativeForCombatant(params: {
	combat: Combat;
	combatantId: string;
	formula: string | null;
	messageOptions: ChatMessage.CreateData;
	rollIndex: number;
	combatManaUpdates: Promise<unknown>[];
}): Promise<InitiativeRollOutcome | null> {
	const combatant = params.combat.combatants.get(params.combatantId);
	if (!combatant?.isOwner) return null;

	const combatantUpdates: Record<string, unknown> = { _id: params.combatantId };

	const roll = combatant.getInitiativeRoll(params.formula ?? undefined);
	await roll.evaluate();
	const rollTotal = roll.total ?? 0;
	combatantUpdates.initiative = rollTotal;
	const foldedActionDelta = getCombatantPendingActionDelta(combatant);
	applyCharacterInitiativeActionUpdate(
		combatant,
		combatantUpdates,
		rollTotal,
		keptD20(roll.terms as unknown[]),
	);

	await handleInitiativeRules({
		combatId: params.combat.id,
		combatManaUpdates: params.combatManaUpdates,
		combatant,
	});

	const chatData = await buildInitiativeChatData({
		combatant,
		roll,
		messageOptions: params.messageOptions,
		rollIndex: params.rollIndex,
		combatId: params.combat.id,
		foldedActionDelta,
	});

	return {
		combatantUpdate: combatantUpdates,
		chatData,
	};
}
