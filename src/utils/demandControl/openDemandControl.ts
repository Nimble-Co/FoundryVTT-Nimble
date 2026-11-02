import DemandControlDialog from '#documents/dialogs/DemandControlDialog.svelte.js';
import localize from '#utils/localize.js';
import { chargeOnlyCost, payRerollCost, refundRerollCost } from '../reroll/rerollCost.js';
import {
	applyControlChoice,
	type ControlChoice,
	type ControlOption,
	recordChoice,
	recordReaction,
} from './demandControl.js';

interface OpenOptions {
	locked?: ControlOption;
	reportsRound?: boolean;
}

type ControlActor = Parameters<typeof applyControlChoice>[0];

async function ask(actor: ControlActor, options: OpenOptions): Promise<ControlChoice | null> {
	const dialog = new DemandControlDialog(
		actor as never,
		localize('NIMBLE.demandControl.title'),
		options,
	);
	await dialog.render(true);
	return dialog.promise;
}

/** Opens the window, then does what the player chose. The tick does it a second time. */
export async function openDemandControl(
	actor: ControlActor,
	options: OpenOptions = {},
): Promise<void> {
	const choice = await ask(actor, options);
	if (!choice) return;
	const cost = { ...chargeOnlyCost(''), actionCost: 1 };
	const paid = choice.asReaction ? await payRerollCost(actor as never, cost) : null;
	if (choice.asReaction && !paid) {
		ui.notifications?.warn(localize('NIMBLE.chat.incomingReactions.rerollCostUnpaid'));
		return;
	}
	if (!(await applyControlChoice(actor, choice))) {
		if (paid) await refundRerollCost(actor as never, cost, paid);
		return;
	}
	if (paid) await recordReaction(actor);
	if (!options.locked) await recordChoice(actor, choice.option, options.reportsRound === true);
	if (choice.twice) {
		const second = await ask(actor, { locked: choice.option });
		if (second) await applyControlChoice(actor, second);
	}
}
