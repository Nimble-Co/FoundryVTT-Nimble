import type {
	SpellScrollDialogProps,
	SpellScrollNavigationTab,
} from '#types/components/SpellScrollDialog.d.ts';

import localize from '#utils/localize.js';
import { getSpellSchoolLabel, getSpellTierLabel } from '#utils/spellLabels.js';

/** The tab the school filter starts on, matching the Spells tab's own "All" entry. */
const ALL_SCHOOLS_TAB: SpellScrollNavigationTab = {
	icon: 'fa-solid fa-grip',
	name: 'all',
	tooltip: 'NIMBLE.spellScroll.dialog.filterAll',
};

export function createSpellScrollDialogState(getProps: () => SpellScrollDialogProps) {
	const { spellSchools, spellSchoolIcons } = CONFIG.NIMBLE;

	let destination = $state<'spellList' | 'scroll'>('spellList');

	let searchTerm = $state('');
	let currentTab = $state<SpellScrollNavigationTab>(ALL_SCHOOLS_TAB);
	let selectedUuid = $state<string | null>(null);
	let expandedUuid = $state<string | null>(null);

	// Reassigned rather than mutated: a plain object in `$state` tracks the
	// reference, not its keys.
	let descriptionsByUuid = $state<Record<string, string>>({});

	/**
	 * Only the schools present among the candidates get a tab. Filtering by the
	 * schools the actor knows, as the Spells tab does, would leave a non-caster
	 * with no tabs at all.
	 */
	const subNavigation = $derived.by<SpellScrollNavigationTab[]>(() => {
		const present = new Set(getProps().candidates?.map((candidate) => candidate.school) ?? []);
		const schoolTabs = Object.keys(spellSchools)
			.filter((schoolId) => present.has(schoolId))
			.map((schoolId) => ({
				icon: spellSchoolIcons[schoolId],
				name: schoolId,
				tooltip: spellSchools[schoolId],
			}));

		return [ALL_SCHOOLS_TAB, ...schoolTabs];
	});

	const visibleCandidates = $derived.by(() => {
		const term = searchTerm.trim().toLowerCase();
		return (getProps().candidates ?? []).filter((candidate) => {
			if (currentTab.name !== 'all' && candidate.school !== currentTab.name) return false;
			if (term && !candidate.name.toLowerCase().includes(term)) return false;
			return true;
		});
	});

	/**
	 * The selection, but only while the player can still see it. Derived rather
	 * than synced, so a filter that hides the selected row cannot leave Inscribe
	 * able to commit a spell that is off screen.
	 */
	const selectedVisibleUuid = $derived(
		visibleCandidates.some((candidate) => candidate.uuid === selectedUuid) ? selectedUuid : null,
	);

	const manaCostLabel = $derived.by(() => {
		const { tier = 0 } = getProps();
		return tier > 0
			? localize('NIMBLE.spellScroll.dialog.addToSpellListHint', { mana: String(tier) })
			: localize('NIMBLE.spellScroll.dialog.addToSpellListHintCantrip');
	});

	const upcastLabel = $derived.by(() => {
		const { tier = 0, highestUnlockedSpellTier = 0 } = getProps();
		return highestUnlockedSpellTier > tier
			? localize('NIMBLE.spellScroll.dialog.upcastUpToTier', {
					tier: getSpellTierLabel(highestUnlockedSpellTier),
				})
			: localize('NIMBLE.spellScroll.dialog.upcastNone');
	});

	const arcanaLabel = $derived.by(() => {
		const { school = '', knowsSchool = false, actorName } = getProps();
		return knowsSchool
			? localize('NIMBLE.spellScroll.dialog.arcanaNotNeeded', {
					school: getSpellSchoolLabel(school),
				})
			: localize('NIMBLE.spellScroll.dialog.arcanaRequired', {
					name: actorName,
					school: getSpellSchoolLabel(school),
				});
	});

	const isSubmitDisabled = $derived(getProps().mode === 'picker' && !selectedVisibleUuid);

	const submitLabel = $derived.by(() => {
		if (getProps().mode === 'picker') return localize('NIMBLE.spellScroll.dialog.inscribe');

		return destination === 'scroll'
			? localize('NIMBLE.spellScroll.dialog.submitAddToInventory')
			: localize('NIMBLE.spellScroll.dialog.submitAddToSpellList');
	});

	const submitIcon = $derived(
		getProps().mode === 'picker' || destination === 'scroll' ? 'fa-scroll' : 'fa-wand-sparkles',
	);

	return {
		get destination() {
			return destination;
		},
		set destination(value: 'spellList' | 'scroll') {
			destination = value;
		},
		get searchTerm() {
			return searchTerm;
		},
		set searchTerm(value: string) {
			searchTerm = value;
		},
		get currentTab() {
			return currentTab;
		},
		set currentTab(value: SpellScrollNavigationTab) {
			currentTab = value;
		},
		get expandedUuid() {
			return expandedUuid;
		},
		get selectedVisibleUuid() {
			return selectedVisibleUuid;
		},
		get subNavigation() {
			return subNavigation;
		},
		get visibleCandidates() {
			return visibleCandidates;
		},
		get manaCostLabel() {
			return manaCostLabel;
		},
		get upcastLabel() {
			return upcastLabel;
		},
		get arcanaLabel() {
			return arcanaLabel;
		},
		get isSubmitDisabled() {
			return isSubmitDisabled;
		},
		get submitLabel() {
			return submitLabel;
		},
		get submitIcon() {
			return submitIcon;
		},

		selectSpell(uuid: string) {
			selectedUuid = uuid;
		},

		/** The enriched description of `uuid`, or null while it is still loading. */
		descriptionFor(uuid: string): string | null {
			return descriptionsByUuid[uuid] ?? null;
		},

		async toggleExpanded(uuid: string) {
			if (expandedUuid === uuid) {
				expandedUuid = null;
				return;
			}

			expandedUuid = uuid;
			if (uuid in descriptionsByUuid) return;

			const description = await getProps().loadDescription?.(uuid);
			descriptionsByUuid = { ...descriptionsByUuid, [uuid]: description ?? '' };
		},

		submit() {
			if (isSubmitDisabled) return;
			const { dialog, mode } = getProps();

			if (mode === 'picker') {
				void dialog.submit({ destination: 'scroll', spellUuid: selectedVisibleUuid ?? undefined });
				return;
			}

			void dialog.submit({ destination });
		},
	};
}
