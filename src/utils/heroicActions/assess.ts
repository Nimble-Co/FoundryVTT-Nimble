import type { NimbleCharacter } from '#documents/actor/character.js';
import type { AssessRequest } from '#types/assess.d.ts';
import { ASSESS_DC, assessOptions } from '#utils/assessOptions.js';
import { getActiveCombatForCurrentScene } from '#utils/combat/combatState.js';
import { consumeCombatantAction } from '#utils/combat/combatTurnActions.js';
import localize from '#utils/localize.js';
import { getTargetedTokens, getTargetName } from '#utils/tokens/targeting.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import {
	createHeldChange,
	ignoreDisadvantageChange,
	spendHeldIgnoreDisadvantage,
} from '../heldChange/heldChange.js';
import { assessSucceeds } from './assessResult.js';

async function spendAssessAction(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene();
	const combatantId = combat?.combatants.find((entry) => entry.actorId === actor.id)?.id ?? null;
	if (!combat || !combatantId) return;

	await consumeCombatantAction({ combat, combatantId, actionCost: 1 });
}

/** What a success holds: C:470 on the target, C:472 on the assessor. In combat only. */
async function holdAssessChange(
	actor: NimbleCharacter,
	optionId: string,
	label: string,
	target: Token | null,
): Promise<number | null> {
	const combat = getActiveCombatForCurrentScene();
	if (!combat?.started || !isRuleAutomationEnabled()) return null;
	const time = {
		appliesTo: 'attacksOnHolder' as const,
		ends: 'round' as const,
		combatId: combat.id ?? '',
		round: combat.round ?? 0,
		turn: combat.turn ?? 0,
		kind: 'primaryDie' as const,
		label,
		sourceName: actor.name ?? '',
	};
	if (optionId === 'create-opening' && target?.actor) {
		await createHeldChange(target.actor as never, { ...time, value: 1, spentBy: 'oneRoll' });
		return 1;
	}
	if (optionId === 'anticipate-danger') {
		await createHeldChange(actor as never, { ...time, value: -1, spentBy: 'everyRoll' });
		return -1;
	}
	return null;
}

function rollPaidAssess(actor: NimbleCharacter, skillKey: AssessRequest['skillKey']) {
	const skillMode = actor.system?.skills?.[skillKey]?.defaultRollMode ?? 0;
	return skillMode < 0 && ignoreDisadvantageChange(actor as never)
		? actor.rollSkillCheck(skillKey, { rollMode: 0 })
		: actor.rollSkillCheck(skillKey);
}

/**
 * Rolls the Assess skill check, spends 1 action in combat and posts the card.
 * Returns false when the option is unknown or the roll is cancelled.
 */
export async function runAssess(actor: NimbleCharacter, request: AssessRequest): Promise<boolean> {
	const option = assessOptions.find((o) => o.id === request.optionId);
	if (!option) return false;

	const targets = option.requiresTarget ? getTargetedTokens(actor.id ?? '') : [];
	const target = targets.length === 1 ? targets[0] : null;
	if (option.requiresTarget && !target) {
		ui.notifications?.warn(localize('NIMBLE.ui.heroicActions.assess.needsTarget'));
		return false;
	}

	const { roll } = await (request.free
		? actor.rollSkillCheck(request.skillKey, { rollMode: 1, skipRollDialog: true })
		: rollPaidAssess(actor, request.skillKey));
	if (!roll) return false;

	if (!request.free) {
		await spendAssessAction(actor);
		await spendHeldIgnoreDisadvantage(actor as never);
	}

	const isSuccess = assessSucceeds(roll);
	const resultKey = isSuccess ? option.successKey : option.failureKey;

	const primaryDieChange = isSuccess
		? await holdAssessChange(actor, option.id, localize(option.titleKey), target)
		: null;
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
			primaryDieChange,
		},
	} as unknown as ChatMessage.CreateData);
	return true;
}
