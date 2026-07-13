import toMessageMode from '../../utils/toMessageMode.js';
import type { InitiativeRollOutcome } from './combatTypes.js';
import { handleInitiativeRules } from './handleInitiativeRules.js';

export function applyCharacterInitiativeActionUpdate(
	combatant: Combatant.Implementation,
	combatantUpdates: Record<string, unknown>,
	rollTotal: number,
): void {
	if (combatant.type !== 'character') return;

	// The initiative roll only sets the character's starting actions for the
	// first round. Their max stays at 3 — per-turn restoration always refills
	// to max (reduced only by the Dying condition), so we must not touch max
	// here or low-initiative heroes would be permanently capped below 3.
	const actionPath = 'system.actions.base.current';
	if (rollTotal >= 20) {
		combatantUpdates[actionPath] = 3;
		return;
	}
	if (rollTotal >= 10) {
		combatantUpdates[actionPath] = 2;
		return;
	}
	combatantUpdates[actionPath] = 1;
}

export async function buildInitiativeChatData(params: {
	combatant: Combatant.Implementation;
	roll: Roll;
	messageOptions: ChatMessage.CreateData;
	rollIndex: number;
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
	applyCharacterInitiativeActionUpdate(combatant, combatantUpdates, rollTotal);

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
	});

	return {
		combatantUpdate: combatantUpdates,
		chatData,
	};
}
