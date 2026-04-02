import type { SpellGrantDisplayProps } from '#types/components/SpellGrantDisplay.d.ts';
import type { SpellIndexEntry } from '#utils/getSpells.js';
import localize from '#utils/localize.js';

export interface SpellGrantDisplayContext {
	CHARACTER_CREATION_STAGES: Record<string, string | number>;
	dialog: { id: string };
}

interface SpellGrantDisplayStateParams {
	props: () => SpellGrantDisplayProps;
	context: SpellGrantDisplayContext;
	onSchoolsChange: (schools: Map<string, string[]>) => void;
	onSpellsChange: (spells: Map<string, string[]>) => void;
	onConfirmedChange: (confirmed: Set<string>) => void;
}

/**
 * Creates reactive state for the SpellGrantDisplay component
 */
export function createSpellGrantDisplayState(params: SpellGrantDisplayStateParams) {
	const { props, context, onSchoolsChange, onSpellsChange, onConfirmedChange } = params;

	// Local editing state
	let isEditing = $state(false);

	// Handlers
	function handleSchoolSelect(ruleId: string, schools: string[]) {
		const currentProps = props();
		const newMap = new Map(currentProps.selectedSchools);
		newMap.set(ruleId, schools);
		onSchoolsChange(newMap);
	}

	function handleSchoolConfirm(ruleId: string) {
		const currentProps = props();
		const newSet = new Set([...currentProps.confirmedSchools, ruleId]);
		onConfirmedChange(newSet);
	}

	function handleSpellSelect(ruleId: string, spellUuids: string[]) {
		const currentProps = props();
		const newMap = new Map(currentProps.selectedSpells);
		newMap.set(ruleId, spellUuids);
		onSpellsChange(newMap);
	}

	function handleEditClick() {
		isEditing = true;
		const currentProps = props();

		// Clear confirmed schools so user can edit again
		onConfirmedChange(new Set());

		// Clear spell selections so user starts fresh
		const newSelectedSpells = new Map(currentProps.selectedSpells);
		const filteredSelections = currentProps.sourceFilter
			? (currentProps.spellGrants?.spellSelections ?? []).filter(
					(g) => g.source === currentProps.sourceFilter,
				)
			: (currentProps.spellGrants?.spellSelections ?? []);

		for (const group of filteredSelections) {
			newSelectedSpells.delete(group.ruleId);
		}
		onSpellsChange(newSelectedSpells);
	}

	// Derived values
	const filteredSchoolSelections = $derived.by(() => {
		const currentProps = props();
		return currentProps.sourceFilter
			? (currentProps.spellGrants?.schoolSelections ?? []).filter(
					(g) => g.source === currentProps.sourceFilter,
				)
			: (currentProps.spellGrants?.schoolSelections ?? []);
	});

	const filteredSpellSelections = $derived.by(() => {
		const currentProps = props();
		return currentProps.sourceFilter
			? (currentProps.spellGrants?.spellSelections ?? []).filter(
					(g) => g.source === currentProps.sourceFilter,
				)
			: (currentProps.spellGrants?.spellSelections ?? []);
	});

	const autoGrantSpells = $derived.by(() => {
		const currentProps = props();
		return currentProps.sourceFilter === 'class' || !currentProps.sourceFilter
			? (currentProps.spellGrants?.autoGrant ?? [])
			: [];
	});

	const sortedAutoGrant = $derived.by(() => {
		return [...autoGrantSpells].sort((a, b) => {
			const schoolCompare = a.school.localeCompare(b.school);
			if (schoolCompare !== 0) return schoolCompare;
			return a.name.localeCompare(b.name);
		});
	});

	const hasSchoolSelections = $derived(filteredSchoolSelections.length > 0);
	const hasSpellSelections = $derived(filteredSpellSelections.length > 0);
	const hasAutoGrants = $derived(autoGrantSpells.length > 0);
	const hasAnyGrants = $derived(hasSchoolSelections || hasSpellSelections || hasAutoGrants);
	const hasAnySelections = $derived(hasSchoolSelections || hasSpellSelections);

	const allSelectionsComplete = $derived.by(() => {
		const currentProps = props();

		// Check school selections are complete AND confirmed
		for (const group of filteredSchoolSelections) {
			const selected = currentProps.selectedSchools.get(group.ruleId) ?? [];
			const requiredCount = Math.min(group.count, group.availableSchools.length);
			if (selected.length < requiredCount) return false;
			if (!currentProps.confirmedSchools.has(group.ruleId)) return false;
		}

		// Check spell selections
		for (const group of filteredSpellSelections) {
			const selected = currentProps.selectedSpells.get(group.ruleId) ?? [];
			const requiredCount = Math.min(group.count, group.availableSpells.length);
			if (selected.length < requiredCount) return false;
		}

		return true;
	});

	const autoGrantsBySchool = $derived.by(() => {
		const grouped = new Map<string, SpellIndexEntry[]>();
		for (const spell of sortedAutoGrant) {
			const existing = grouped.get(spell.school) ?? [];
			existing.push(spell);
			grouped.set(spell.school, existing);
		}
		return grouped;
	});

	const effectiveSectionId = $derived.by(() => {
		const currentProps = props();
		return (
			currentProps.sectionId ??
			`${context.dialog.id}-stage-${context.CHARACTER_CREATION_STAGES.SPELLS}`
		);
	});

	const headerText = $derived.by(() => {
		const currentProps = props();
		return currentProps.header ?? localize('NIMBLE.spellGrants.header');
	});

	const showExpanded = $derived.by(() => {
		const currentProps = props();
		return currentProps.active || isEditing;
	});

	// Effect to auto-exit editing mode when all selections are complete
	$effect(() => {
		if (isEditing && allSelectionsComplete) {
			isEditing = false;
		}
	});

	return {
		// State
		get isEditing() {
			return isEditing;
		},

		// Derived values
		get filteredSchoolSelections() {
			return filteredSchoolSelections;
		},
		get filteredSpellSelections() {
			return filteredSpellSelections;
		},
		get autoGrantSpells() {
			return autoGrantSpells;
		},
		get sortedAutoGrant() {
			return sortedAutoGrant;
		},
		get hasSchoolSelections() {
			return hasSchoolSelections;
		},
		get hasSpellSelections() {
			return hasSpellSelections;
		},
		get hasAutoGrants() {
			return hasAutoGrants;
		},
		get hasAnyGrants() {
			return hasAnyGrants;
		},
		get hasAnySelections() {
			return hasAnySelections;
		},
		get allSelectionsComplete() {
			return allSelectionsComplete;
		},
		get autoGrantsBySchool() {
			return autoGrantsBySchool;
		},
		get effectiveSectionId() {
			return effectiveSectionId;
		},
		get headerText() {
			return headerText;
		},
		get showExpanded() {
			return showExpanded;
		},

		// Handlers
		handleSchoolSelect,
		handleSchoolConfirm,
		handleSpellSelect,
		handleEditClick,
	};
}
