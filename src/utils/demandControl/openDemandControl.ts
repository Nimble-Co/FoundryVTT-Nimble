import DemandControlDialog from '#documents/dialogs/DemandControlDialog.svelte.js';
import localize from '#utils/localize.js';
import { chargeOnlyCost, payRerollCost } from '../reroll/rerollCost.js';
import {
	applyControlChoice,
	type ControlChoice,
	type ControlOption,
	recordChoice,
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
	if (choice.asReaction) {
		const paid = await payRerollCost(actor as never, {
			...chargeOnlyCost(''),
			heroicReaction: 'defend',
		});
		if (!paid) {
			ui.notifications?.warn(localize('NIMBLE.chat.incomingReactions.rerollCostUnpaid'));
			return;
		}
	}
	if (!options.locked) await recordChoice(actor, choice.option);
	await applyControlChoice(actor, choice);
	if (choice.twice) {
		const second = await ask(actor, { locked: choice.option });
		if (second) await applyControlChoice(actor, second);
	}
}
