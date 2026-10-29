import type { NimbleCharacter } from '#documents/actor/character.js';
import type { SkillKeyType } from '#types/skillKey.js';
import { ASSESS_DC, assessOptions } from '#utils/assessOptions.js';
import { getActiveCombatForCurrentScene } from '#utils/combat/combatState.js';
import { consumeCombatantAction } from '#utils/combat/combatTurnActions.js';
import localize from '#utils/localize.js';
import { getTargetedTokens, getTargetName } from '#utils/tokens/targeting.js';

export interface AssessRequest {
	optionId: string;
	skillKey: SkillKeyType;
}

async function spendAssessAction(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene();
	const combatantId = combat?.combatants.find((entry) => entry.actorId === actor.id)?.id ?? null;
	if (!combat || !combatantId) return;

	await consumeCombatantAction({ combat, combatantId, actionCost: 1 });
}

/**
 * Rolls the Assess skill check, spends 1 action in combat and posts the card.
 * Returns false when the option is unknown or the roll is cancelled.
 */
export async function runAssess(actor: NimbleCharacter, request: AssessRequest): Promise<boolean> {
	const option = assessOptions.find((o) => o.id === request.optionId);
	if (!option) return false;

	const { roll } = await actor.rollSkillCheck(request.skillKey);
	if (!roll) return false;

	await spendAssessAction(actor);

	const isSuccess = (roll.total ?? 0) >= ASSESS_DC;
	const resultKey = isSuccess ? option.successKey : option.failureKey;

	const targets = option.requiresTarget ? getTargetedTokens(actor.id ?? '') : [];
	const target = targets.length === 1 ? targets[0] : null;
	const targetName = target ? getTargetName(target) : null;
	const resultMessage = localize(resultKey, { name: actor.name, target: targetName ?? '' });

	await ChatMessage.create({
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor }),
		sound: CONFIG.sounds.dice,
		rolls: [roll],
		type: 'assessAction',
		system: {
			actorName: actor.name,
			actorType: actor.type,
			permissions: actor.permission,
			rollMode: 0,
			skillKey: request.skillKey,
			dc: ASSESS_DC,
			isSuccess,
			optionTitle: localize(option.chatTitleKey),
			resultMessage,
			target: target ? target.document.uuid : null,
			targetName,
		},
	} as unknown as ChatMessage.CreateData);
	return true;
}
