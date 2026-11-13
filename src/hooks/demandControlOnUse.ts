import { systemHookName } from '#system';
import {
	controlRules,
	registerDemandControlQuery,
	resetChosen,
} from '#utils/demandControl/demandControl.js';
import { openDemandControl } from '#utils/demandControl/openDemandControl.js';
import { createHeldChange } from '#utils/heldChange/heldChange.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

interface UsedItem {
	id?: string | null;
	name?: string;
	uuid?: string;
	actor?: unknown;
	rules?: Iterable<unknown> | Map<string, unknown>;
}

interface RuleOfItem {
	type?: string;
	opensOnUse?: boolean;
	oncePerRound?: boolean;
	ignoresDisadvantage?: boolean;
	item?: { id?: string | null };
}

function holdIgnoreDisadvantage(actor: never, item: UsedItem): Promise<void> {
	return createHeldChange(actor, {
		kind: 'ignoreDisadvantage',
		value: 0,
		label: item.name ?? '',
		appliesTo: 'holderAttacks',
		spentBy: 'oneRoll',
		ends: 'turn',
		origin: item.uuid ?? null,
	});
}

/** The client that used the item opens the window. Initiative starts the list again. */
export function registerDemandControlHooks(): void {
	registerDemandControlQuery(openDemandControl);

	Hooks.on(
		systemHookName('useItem') as never,
		(async (item: UsedItem) => {
			if (!isRuleAutomationEnabled()) return;
			const actor = item.actor as never;
			const rule = controlRules(actor).find(
				(each) => (each as RuleOfItem).item?.id === item.id && each.opensOnUse,
			);
			if (!rule) return;
			if (rule.ignoresDisadvantage) await holdIgnoreDisadvantage(actor, item);
			await openDemandControl(actor, { reportsRound: rule.oncePerRound === true });
		}) as never,
	);

	Hooks.on(
		systemHookName('initiativeRolled') as never,
		((payload: { actor?: unknown }) => {
			const actor = payload?.actor as { isOwner?: boolean } | undefined;
			if (actor?.isOwner) void resetChosen(actor as never);
		}) as never,
	);
}
