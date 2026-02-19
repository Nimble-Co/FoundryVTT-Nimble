import { getMinionGroupSummaries } from '../utils/minionGrouping.js';
import {
	MINION_GROUPING_MODE_SETTING_KEY,
	shouldUseCanvasLiteTemporaryGroups,
} from '../utils/minionGroupingModes.js';

type CombatWithGrouping = Combat & {
	dissolveMinionGroups?: (groupIds: string[]) => Promise<Combatant.Implementation[]>;
};

let didRegisterMinionGroupingModeSync = false;

function getSettingKey(setting: unknown): string | null {
	if (!setting || typeof setting !== 'object') return null;
	const key = (setting as { key?: unknown }).key;
	return typeof key === 'string' ? key : null;
}

async function dissolveAllMinionGroupsForAllCombats(reason: string): Promise<void> {
	if (!game.user?.isGM) return;
	if (!shouldUseCanvasLiteTemporaryGroups()) return;

	for (const combat of game.combats.contents) {
		const combatWithGrouping = combat as CombatWithGrouping;
		if (typeof combatWithGrouping.dissolveMinionGroups !== 'function') continue;

		const groupedIds = [...getMinionGroupSummaries(combat.combatants.contents).keys()];
		if (groupedIds.length === 0) continue;

		await combatWithGrouping.dissolveMinionGroups(groupedIds);
		// eslint-disable-next-line no-console
		console.info('[Nimble][MinionGrouping][Mode] Dissolved existing groups after mode change', {
			reason,
			combatId: combat.id ?? null,
			groupIds: groupedIds,
		});
	}
}

export default function registerMinionGroupingModeSync(): void {
	if (didRegisterMinionGroupingModeSync) return;
	didRegisterMinionGroupingModeSync = true;

	Hooks.on('updateSetting', (setting: unknown) => {
		const key = getSettingKey(setting);
		if (!key) return;
		if (key !== `nimble.${MINION_GROUPING_MODE_SETTING_KEY}`) return;

		queueMicrotask(() => {
			void dissolveAllMinionGroupsForAllCombats('settingChangedToCanvasLite');
		});
	});
}
