import FreeAssessDialog from '#documents/dialogs/FreeAssessDialog.svelte.js';
import { SYSTEM_ID, systemHookName } from '#system';
import { actorRules, ruleLabel } from '#utils/actor/actorRules.js';
import { hasRuleCharge, spendRuleCharge } from '#utils/chargePool/ruleChargeGate.js';
import { runAssess } from '#utils/heroicActions/assess.js';
import localize from '#utils/localize.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

const FLAG = 'freeAssessRound';

interface FreeAssessRuleLike {
	type?: string;
	disabled?: boolean;
	test?(): boolean;
	chargePoolIdentifier?: string;
	item?: { id?: string | null } | null;
}

interface FlagActor {
	getFlag?(scope: string, key: string): unknown;
	setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
}

function currentRound(): string | null {
	const combat = game.combat;
	return combat?.started ? `${combat.id}:${combat.round}` : null;
}

/** The client that used the item opens the window. 1/round is reported, not blocked. */
export function registerFreeAssessHooks(): void {
	Hooks.on(
		systemHookName('useItem') as never,
		(async (item: { id?: string | null; actor?: unknown }) => {
			if (!isRuleAutomationEnabled()) return;
			const actor = item.actor as FlagActor & Parameters<typeof actorRules>[0];
			const rule = actorRules<FreeAssessRuleLike>(actor).find(
				(each) =>
					each?.type === 'freeAssess' &&
					!each.disabled &&
					each.item?.id === item.id &&
					each.test?.() !== false,
			);
			if (!rule) return;

			const round = currentRound();
			const pool = rule.chargePoolIdentifier ?? '';
			const hasCharge = !!pool && hasRuleCharge(actor as never, pool);
			const title = ruleLabel(rule as never);
			const dialog = new FreeAssessDialog(actor as never, title, {
				roundUsed: !!round && actor.getFlag?.(SYSTEM_ID, FLAG) === round,
				spendLine: localize(
					`NIMBLE.ui.heroicActions.assess.free${hasCharge ? 'WithCharge' : 'NoCharge'}`,
				),
			});
			await dialog.render(true);
			const result = await dialog.promise;
			if (!result) return;

			const made = await runAssess(actor as never, { ...result, free: true });
			if (!made) return;
			if (round) await actor.setFlag?.(SYSTEM_ID, FLAG, round);
			if (hasCharge) await spendRuleCharge(actor as never, pool);
		}) as never,
	);
}
