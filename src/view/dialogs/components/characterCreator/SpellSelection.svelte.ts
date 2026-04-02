import { sortSpellsBySchoolThenName } from '#utils/getSpells.js';
import type { SpellSelectionGroup } from '../../characterCreation/types.js';

interface SpellSelectionStateParams {
	group: () => SpellSelectionGroup;
	selected: () => string[];
	onSelect: (spellUuids: string[]) => void;
}

/**
 * Creates reactive state for the SpellSelection component
 */
export function createSpellSelectionState(params: SpellSelectionStateParams) {
	const { group, selected, onSelect } = params;

	// Track whether to show all spells or just selected ones
	let showAllSpells = $state(false);

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

	// Derived values
	const sortedSpells = $derived.by(() => {
		return sortSpellsBySchoolThenName(group().availableSpells);
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

	const displayedSpells = $derived.by(() => {
		return isSelectionComplete && !showAllSpells ? selectedSpells : sortedSpells;
	});

	return {
		// State
		get showAllSpells() {
			return showAllSpells;
		},

		// Derived values
		get sortedSpells() {
			return sortedSpells;
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
		get displayedSpells() {
			return displayedSpells;
		},

		// Handlers
		toggleSpell,
		isSelected,
		isDisabled,
		setShowAllSpells,
	};
}
