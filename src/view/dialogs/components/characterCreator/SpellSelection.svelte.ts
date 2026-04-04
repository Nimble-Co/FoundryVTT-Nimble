import type { SpellIndexEntry } from '#utils/getSpells.js';
import { sortSpellsBySchoolThenName } from '#utils/getSpells.js';
import type { SpellSelectionGroup } from '../../characterCreation/types.js';

export interface SpellSchoolGroup {
	school: string;
	spells: SpellIndexEntry[];
}

interface SpellSelectionStateParams {
	group: () => SpellSelectionGroup;
	selected: () => string[];
	onSelect: (spellUuids: string[]) => void;
}

/**
 * Gets unique schools from spells, sorted alphabetically
 */
function getAvailableSchools(spells: SpellIndexEntry[]): string[] {
	const schools = new Set<string>();
	for (const spell of spells) {
		schools.add(spell.school);
	}
	return [...schools].sort((a, b) => a.localeCompare(b));
}

/**
 * Groups spells by school, sorted alphabetically by school name
 */
function groupSpellsBySchool(spells: SpellIndexEntry[]): SpellSchoolGroup[] {
	const schoolMap = new Map<string, SpellIndexEntry[]>();

	for (const spell of spells) {
		const existing = schoolMap.get(spell.school);
		if (existing) {
			existing.push(spell);
		} else {
			schoolMap.set(spell.school, [spell]);
		}
	}

	// Sort schools alphabetically, then sort spells within each school by name
	return [...schoolMap.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([school, schoolSpells]) => ({
			school,
			spells: schoolSpells.sort((a, b) => a.name.localeCompare(b.name)),
		}));
}

/**
 * Creates reactive state for the SpellSelection component
 */
export function createSpellSelectionState(params: SpellSelectionStateParams) {
	const { group, selected, onSelect } = params;

	// Track whether to show all spells or just selected ones
	let showAllSpells = $state(false);

	// Track the currently selected school filter
	// Will be initialized to first school via effect
	let activeSchoolFilter = $state<string | null>(null);
	let hasInitializedFilter = false;

	// Auto-select first school on initialization
	$effect(() => {
		const schools = getAvailableSchools(group().availableSpells);
		if (!hasInitializedFilter && schools.length > 0) {
			activeSchoolFilter = schools[0];
			hasInitializedFilter = true;
		}
	});

	// Selection handlers
	function toggleSpell(spellUuid: string) {
		const currentGroup = group();
		const currentSelection = [...selected()];

		if (currentSelection.includes(spellUuid)) {
			// Remove spell - show all options again
			const filtered = currentSelection.filter((s) => s !== spellUuid);
			onSelect(filtered);
			showAllSpells = true;
		} else if (currentSelection.length < currentGroup.count) {
			// Add spell (only if we haven't reached the limit)
			onSelect([...currentSelection, spellUuid]);
			// If selection is now complete, collapse to show only selected
			if (currentSelection.length + 1 >= currentGroup.count) {
				showAllSpells = false;
			}
		}
	}

	function isSelected(spellUuid: string): boolean {
		return selected().includes(spellUuid);
	}

	function isDisabled(spellUuid: string): boolean {
		const currentGroup = group();
		return !isSelected(spellUuid) && selected().length >= currentGroup.count;
	}

	function setShowAllSpells(value: boolean) {
		showAllSpells = value;
	}

	function setActiveSchoolFilter(school: string | null) {
		activeSchoolFilter = school;
	}

	// Derived values
	const sortedSpells = $derived.by(() => {
		return sortSpellsBySchoolThenName(group().availableSpells);
	});

	const availableSchools = $derived.by(() => {
		return getAvailableSchools(group().availableSpells);
	});

	const spellsBySchool = $derived.by(() => {
		return groupSpellsBySchool(group().availableSpells);
	});

	const isSelectionComplete = $derived.by(() => {
		return selected().length >= group().count;
	});

	const selectedSpells = $derived.by(() => {
		const currentSelected = selected();
		return sortedSpells.filter((spell) => currentSelected.includes(spell.uuid));
	});

	const selectedSpellNames = $derived.by(() => {
		return selectedSpells.map((s) => s.name).join(', ');
	});

	const filteredSpells = $derived.by(() => {
		if (!activeSchoolFilter) {
			return sortedSpells;
		}
		return sortedSpells.filter((spell) => spell.school === activeSchoolFilter);
	});

	const displayedSpells = $derived.by(() => {
		return isSelectionComplete && !showAllSpells ? selectedSpells : filteredSpells;
	});

	const displayedSpellsBySchool = $derived.by(() => {
		if (isSelectionComplete && !showAllSpells) {
			return groupSpellsBySchool(selectedSpells);
		}
		return spellsBySchool;
	});

	return {
		// State
		get showAllSpells() {
			return showAllSpells;
		},
		get activeSchoolFilter() {
			return activeSchoolFilter;
		},

		// Derived values
		get sortedSpells() {
			return sortedSpells;
		},
		get availableSchools() {
			return availableSchools;
		},
		get spellsBySchool() {
			return spellsBySchool;
		},
		get isSelectionComplete() {
			return isSelectionComplete;
		},
		get selectedSpells() {
			return selectedSpells;
		},
		get selectedSpellNames() {
			return selectedSpellNames;
		},
		get filteredSpells() {
			return filteredSpells;
		},
		get displayedSpells() {
			return displayedSpells;
		},
		get displayedSpellsBySchool() {
			return displayedSpellsBySchool;
		},

		// Handlers
		toggleSpell,
		isSelected,
		isDisabled,
		setShowAllSpells,
		setActiveSchoolFilter,
	};
}
