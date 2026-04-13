import type { LevelUpSpellGrantsProps } from '#types/components/LevelUpSpellGrants.d.ts';
import type { SpellIndexEntry } from '#utils/getSpells.js';

/**
 * Creates reactive state for the LevelUpSpellGrants component.
 *
 * Groups auto-granted spells by school and provides handlers for
 * school selection changes and confirmations.
 */
export function createLevelUpSpellGrantsState(getProps: () => LevelUpSpellGrantsProps) {
	const hasAnyGrants = $derived(
		getProps().spells.length > 0 ||
			getProps().schoolSelections.length > 0 ||
			getProps().spellSelections.length > 0,
	);

	const spellsBySchool = $derived.by(() => {
		const grouped = new Map<string, SpellIndexEntry[]>();
		for (const spell of getProps().spells) {
			const existing = grouped.get(spell.school) ?? [];
			existing.push(spell);
			grouped.set(spell.school, existing);
		}
		return grouped;
	});

	function handleSchoolSelect(ruleId: string, schools: string[]) {
		const props = getProps();
		const newMap = new Map(props.selectedSchools);
		newMap.set(ruleId, schools);
		props.onSchoolsChange(newMap);
	}

	function handleSchoolConfirm(ruleId: string) {
		const props = getProps();
		const newSet = new Set([...props.confirmedSchools, ruleId]);
		props.onConfirmedChange(newSet);
	}

	function handleSchoolEdit(ruleId: string) {
		const props = getProps();
		const newSet = new Set([...props.confirmedSchools].filter((id) => id !== ruleId));
		props.onConfirmedChange(newSet);
	}

	function handleSpellSelect(ruleId: string, spellUuids: string[]) {
		const props = getProps();
		const newMap = new Map(props.selectedSpells);
		newMap.set(ruleId, spellUuids);
		props.onSpellsChange(newMap);
	}

	return {
		get hasAnyGrants() {
			return hasAnyGrants;
		},
		get spellsBySchool() {
			return spellsBySchool;
		},
		handleSchoolSelect,
		handleSchoolConfirm,
		handleSchoolEdit,
		handleSpellSelect,
	};
}
