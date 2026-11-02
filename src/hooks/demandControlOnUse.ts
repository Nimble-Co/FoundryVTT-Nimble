import { systemHookName } from '#system';
import {
	controlRules,
	registerDemandControlQuery,
	resetChosen,
} from '#utils/demandControl/demandControl.js';
import { openDemandControl } from '#utils/demandControl/openDemandControl.js';
import { createHeldChange } from '#utils/heldChange/heldChange.js';

interface UsedItem {
	id?: string | null;
	name?: string;
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

function holdIgnoreDisadvantage(actor: never, label: string): Promise<void> {
	const combat = game.combat;
	return createHeldChange(actor, {
		kind: 'ignoreDisadvantage',
		value: 0,
		label,
		sourceName: label,
		appliesTo: 'holderAttacks',
		spentBy: 'oneRoll',
		ends: 'turn',
		combatId: combat?.started ? (combat.id ?? '') : '',
		round: combat?.round ?? 0,
		turn: combat?.turn ?? 0,
	});
}

/** The client that used the item opens the window. Initiative starts the list again. */
export function registerDemandControlHooks(): void {
	registerDemandControlQuery(openDemandControl as never);

	Hooks.on(
		systemHookName('useItem') as never,
		(async (item: UsedItem) => {
			const actor = item.actor as never;
			const rule = controlRules(actor).find(
				(each) => (each as RuleOfItem).item?.id === item.id && each.opensOnUse,
			);
			if (!rule) return;
			if (rule.ignoresDisadvantage) await holdIgnoreDisadvantage(actor, item.name ?? '');
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
