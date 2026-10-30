import type { MonsterSheetProps } from '#types/components/actorSheets/MonsterSheet.d.ts';
import { flashRows, trackWidth } from '../shared/sheetFrame.svelte.ts';
import { setClosedRows } from '../shared/sheetUiState.ts';
import { monsterAbilitiesTab } from './monsterAbilitiesTab.ts';
import { monsterEffectsTab } from './monsterEffectsTab.ts';
import { monsterFrame } from './monsterFrame.ts';
import { monsterNotesTab } from './monsterNotesTab.ts';
import { monsterRail } from './monsterRail.ts';
import { monsterSettingsTab } from './monsterSettingsTab.ts';

const NARROW_BELOW = 560;

/**
 * The state of the NPC sheet root: its width, the views (each tab view only while its tab shows),
 * and Expand all of the Abilities tab. Call it while the component starts.
 */
export function createMonsterSheetState(
	props: () => MonsterSheetProps,
	root: () => HTMLElement | undefined,
) {
	const size = trackWidth(root, 660);
	flashRows(root, () => props().ui.flash);

	const ui = $derived(props().ui);
	const current = $derived(props().source());
	const rail = $derived(monsterRail(current.actor, current.context));
	const frame = $derived(monsterFrame(current.actor, current.context));
	const abilities = $derived(
		ui.tab === 'abilities' ? monsterAbilitiesTab(current.actor, current.context) : null,
	);
	const effects = $derived(
		ui.tab === 'effects' ? monsterEffectsTab(current.actor, current.context) : null,
	);
	const notes = $derived(
		ui.tab === 'notes' ? monsterNotesTab(current.actor, current.context) : null,
	);
	const settings = $derived(
		ui.tab === 'settings' ? monsterSettingsTab(current.actor, current.context) : null,
	);
	const expandAll = $derived.by(() => {
		if (!abilities?.cardIds.length) return null;
		const ids = abilities.cardIds;
		const allOpen = ids.every((id) => !ui.closedRows.includes(id));
		return { allOpen, onclick: () => setClosedRows(ui, allOpen ? ids : []) };
	});

	return {
		get wide() {
			return size.width >= NARROW_BELOW;
		},
		get rail() {
			return rail;
		},
		get frame() {
			return frame;
		},
		get abilities() {
			return abilities;
		},
		get effects() {
			return effects;
		},
		get notes() {
			return notes;
		},
		get settings() {
			return settings;
		},
		get expandAll() {
			return expandAll;
		},
		get createFeature() {
			return abilities?.createFeature ?? null;
		},
	};
}
