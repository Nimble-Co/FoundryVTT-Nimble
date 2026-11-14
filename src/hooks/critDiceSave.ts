import { SYSTEM_ID, systemHookName } from '#system';
import {
	registerCritDiceSaveLineQuery,
	showCritDiceSaveLine,
} from '#utils/rolls/critDiceSaveLine.js';
import { type CritDiceSaveLink, settleCritDiceSave } from '#utils/rolls/critDiceSaveSettle.js';
import { registerRollSaveQuery } from '#utils/rolls/rollSaveWithOwner.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';
import type { NimbleSavePayload } from './ruleEventDispatch.js';

/**
 * The save of a crit dice rule has a result: a failure sets the dice to
 * their max, a pass gives the use back, and a result that goes away undoes both.
 * With Feature Effects off, the save card gets a line with a button for it.
 */
async function followSave(payload: NimbleSavePayload): Promise<void> {
	if (!game.user?.isGM) return;
	const saveCard = game.messages?.get(payload.messageId ?? '') as
		| { id?: string | null; getFlag(scope: string, key: string): unknown }
		| undefined;
	const link = saveCard?.getFlag(SYSTEM_ID, 'critDiceSave') as CritDiceSaveLink | undefined;
	if (!saveCard || !link) return;
	if (isRuleAutomationEnabled()) {
		await settleCritDiceSave(link, payload.outcome);
		return;
	}
	if (game.user.isActiveGM) await showCritDiceSaveLine(saveCard, link, payload.outcome);
}

let didRegister = false;

export function registerCritDiceSaveHooks(): void {
	if (didRegister) return;
	didRegister = true;
	registerRollSaveQuery();
	registerCritDiceSaveLineQuery();
	// @ts-expect-error - nimble.saveResolved is a custom Nimble hook
	Hooks.on(systemHookName('saveResolved'), (payload: NimbleSavePayload) => {
		void followSave(payload).catch((error) => {
			console.error('Nimble | A save could not change the dice of its attack.', error);
		});
	});
}
