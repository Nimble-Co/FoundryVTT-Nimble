import type { NimbleBaseActor } from '../documents/actor/base.svelte.js';

import constructD20RollFormula from '../dice/constructD20RollFormula.js';
import { ModifierManager } from '../managers/ModifierManager.js';

export default function getRollFormula(
	actor: NimbleBaseActor,
	rollData = {} as ModifierManager.RollDataOptions,
) {
	const modifierManager = new ModifierManager(actor, rollData);

	return constructD20RollFormula({
		actor,
		rollMode: rollData.rollMode ?? CONFIG.NIMBLE.ROLL_MODE.NORMAL,
		minRoll: rollData.minRoll ?? 1,
		item: rollData.item ?? undefined,
		modifiers: modifierManager.getModifiers(),
	}).rollFormula;
}
