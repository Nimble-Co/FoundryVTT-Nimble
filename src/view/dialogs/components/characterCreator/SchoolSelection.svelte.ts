import {
	getSpellsFromIndex,
	type SpellIndex,
	sortSpellsBySchoolThenName,
} from '#utils/getSpells.js';
import localize from '#utils/localize.js';
import type { SchoolSelectionGroup } from '../../characterCreation/types.js';

interface SchoolSelectionStateParams {
	group: () => SchoolSelectionGroup;
	spellIndex: () => SpellIndex;
	selected: () => string[];
	onSelect: (schools: string[]) => void;
	onConfirm: () => void;
}

/**
 * Creates reactive state for the SchoolSelection component
 */
export function createSchoolSelectionState(params: SchoolSelectionStateParams) {
	const { group, spellIndex, selected, onSelect, onConfirm } = params;

	// Selection handlers
	function selectSchool(school: string) {
		const currentGroup = group();
		const currentSelection = [...selected()];

		if (currentSelection.includes(school)) {
			// Deselect school
			const filtered = currentSelection.filter((s) => s !== school);
			onSelect(filtered);
		} else {
			// Select school (replace current selection if at limit, otherwise add)
			if (currentSelection.length >= currentGroup.count) {
				// Replace the current selection
				onSelect([school]);
			} else {
				// Add to selection
				onSelect([...currentSelection, school]);
			}
		}
	}

	function confirmSelection() {
		onConfirm();
	}

	// Label helpers
	function getSchoolLabel(school: string): string {
		return localize(CONFIG.NIMBLE.spellSchools[school] ?? school);
	}

	function getSchoolIcon(school: string): string {
		return CONFIG.NIMBLE.spellSchoolIcons[school] ?? 'fa-solid fa-sparkles';
	}

	// Derived values
	const selectedSpells = $derived.by(() => {
		const currentSelected = selected();
		const currentGroup = group();
		const currentIndex = spellIndex();

		if (currentSelected.length === 0) return [];

		return sortSpellsBySchoolThenName(
			getSpellsFromIndex(currentIndex, currentSelected, currentGroup.tiers, {
				utilityOnly: currentGroup.utilityOnly,
				forClass: currentGroup.forClass,
			}),
		);
	});

	const isSelectionComplete = $derived.by(() => {
		const currentGroup = group();
		return selected().length >= currentGroup.count;
	});

	return {
		// Derived values
		get selectedSpells() {
			return selectedSpells;
		},
		get isSelectionComplete() {
			return isSelectionComplete;
		},

		// Handlers
		selectSchool,
		confirmSelection,

		// Helpers
		getSchoolLabel,
		getSchoolIcon,
	};
}
