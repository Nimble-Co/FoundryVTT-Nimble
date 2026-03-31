import type { InitiativeRollOutcome } from './combatTypes.js';
import { handleInitiativeRules } from './handleInitiativeRules.js';

export function applyCharacterInitiativeActionUpdate(
	combatant: Combatant.Implementation,
	combatantUpdates: Record<string, unknown>,
	rollTotal: number,
): void {
	if (combatant.type !== 'character') return;

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
	chatRollMode: string | null;
	rollIndex: number;
}): Promise<ChatMessage.CreateData> {
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
		params.messageOptions,
	) as ChatMessage.CreateData;
	const chatData = (await params.roll.toMessage(messageData, {
		create: false,
	})) as ChatMessage.CreateData & { rollMode?: string | null; sound?: string | null };

	// If the combatant is hidden, use a private roll unless an alternative rollMode was requested.
	const msgOpts = params.messageOptions as ChatMessage.CreateData & { rollMode?: string };
	chatData.rollMode =
		'rollMode' in msgOpts
			? (msgOpts.rollMode ?? undefined)
			: params.combatant.hidden
				? CONST.DICE_ROLL_MODES.PRIVATE
				: params.chatRollMode;

	// Play 1 sound for the whole rolled set.
	if (params.rollIndex > 0) chatData.sound = null;
	return chatData;
}

export async function rollInitiativeForCombatant(params: {
	combat: Combat;
	combatantId: string;
	formula: string | null;
	messageOptions: ChatMessage.CreateData;
	chatRollMode: string | null;
	rollOptions?: Record<string, unknown>;
	rollIndex: number;
	combatManaUpdates: Promise<unknown>[];
}): Promise<InitiativeRollOutcome | null> {
	const combatant = params.combat.combatants.get(params.combatantId);
	if (!combatant?.isOwner) return null;
	const combatantWithRollOptions = combatant as Combatant.Implementation & {
		getInitiativeRoll: (formula?: string, rollOptions?: Record<string, unknown>) => Roll;
	};

	const combatantUpdates: Record<string, unknown> = { _id: params.combatantId };

	const roll = combatantWithRollOptions.getInitiativeRoll(
		params.formula ?? undefined,
		params.rollOptions ?? {},
	);
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
		chatRollMode: params.chatRollMode,
		rollIndex: params.rollIndex,
	});

	return {
		combatantUpdate: combatantUpdates,
		chatData,
	};
}
