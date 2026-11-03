import ChoiceDialog from '#documents/dialogs/ChoiceDialog.svelte.js';
import { SYSTEM_ID, systemHookName } from '#system';
import type { AssessRequest } from '#types/assess.d.ts';
import { actorRules, ruleLabel } from '#utils/actor/actorRules.js';
import { hasRuleCharge, spendRuleCharge } from '#utils/chargePool/ruleChargeGate.js';
import { currentRoundId } from '#utils/combat/perTurnUse.js';
import { runAssess } from '#utils/heroicActions/assess.js';
import localize from '#utils/localize.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';
import FreeAssessDialogComponent from '../view/dialogs/FreeAssessDialog.svelte';

const FLAG = 'freeAssessRound';

interface FreeAssessRuleLike {
	type?: string;
	disabled?: boolean;
	test?(): boolean;
	chargePoolIdentifier?: string;
	label?: string;
	item?: { id?: string | null; name?: string | null } | null;
}

/** The client that used the item opens the window. 1/round is reported, not blocked. */
export function registerFreeAssessHooks(): void {
	Hooks.on(
		systemHookName('useItem') as never,
		(async (item: { id?: string | null; actor?: Actor.Implementation | null }) => {
			if (!isRuleAutomationEnabled()) return;
			const actor = item.actor;
			if (!actor) return;
			const rule = actorRules<FreeAssessRuleLike>(actor as { rules?: unknown }).find(
				(each) =>
					each?.type === 'freeAssess' &&
					!each.disabled &&
					each.item?.id === item.id &&
					each.test?.() !== false,
			);
			if (!rule) return;

			const round = currentRoundId();
			const pool = rule.chargePoolIdentifier ?? '';
			const hasCharge = !!pool && hasRuleCharge(actor, pool);
			const title = ruleLabel(rule);
			const dialog = new ChoiceDialog<Omit<AssessRequest, 'free'>>(actor, {
				component: FreeAssessDialogComponent,
				icon: 'fa-solid fa-magnifying-glass',
				title,
				data: {
					roundUsed: !!round && actor.getFlag?.(SYSTEM_ID, FLAG) === round,
					spendLine: localize(
						`NIMBLE.ui.heroicActions.assess.free${hasCharge ? 'WithCharge' : 'NoCharge'}`,
					),
				},
			});
			await dialog.render(true);
			const result = await dialog.promise;
			if (!result) return;

			const made = await runAssess(actor as never, { ...result, free: true });
			if (!made) return;
			if (round) await actor.setFlag?.(SYSTEM_ID, FLAG, round);
			if (hasCharge) await spendRuleCharge(actor, pool);
		}) as never,
	);
}
