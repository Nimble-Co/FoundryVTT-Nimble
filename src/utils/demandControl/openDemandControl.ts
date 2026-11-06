import ChoiceDialog from '#documents/dialogs/ChoiceDialog.svelte.js';
import type { ControlChoice, ControlOption } from '#types/optionWindow.d.ts';
import localize from '#utils/localize.js';
import DemandControlDialogComponent from '../../view/dialogs/DemandControlDialog.svelte';
import { giveBack, payCost } from '../cost/costLedger.js';
import { chargeOnlyCost } from '../reroll/rerollCost.js';
import { applyControlChoice, recordChoice, recordReaction } from './demandControl.js';

interface OpenOptions {
	locked?: ControlOption;
	reportsRound?: boolean;
}

type ControlActor = Parameters<typeof applyControlChoice>[0];

async function ask(actor: ControlActor, options: OpenOptions): Promise<ControlChoice | null> {
	const dialog = new ChoiceDialog<ControlChoice>(actor, {
		component: DemandControlDialogComponent,
		icon: 'fa-solid fa-hand',
		title: localize('NIMBLE.demandControl.title'),
		data: options,
	});
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
	const paid = choice.asReaction ? await payCost(actor as never, cost) : null;
	if (choice.asReaction && !paid) {
		ui.notifications?.warn(localize('NIMBLE.chat.incomingReactions.rerollCostUnpaid'));
		return;
	}
	if (!(await applyControlChoice(actor, choice))) {
		if (paid) await giveBack(actor as never, cost, paid);
		return;
	}
	if (paid) await recordReaction(actor);
	if (!options.locked) await recordChoice(actor, choice.option, options.reportsRound === true);
	if (choice.twice) {
		const second = await ask(actor, { locked: choice.option });
		if (second) await applyControlChoice(actor, second);
	}
}
