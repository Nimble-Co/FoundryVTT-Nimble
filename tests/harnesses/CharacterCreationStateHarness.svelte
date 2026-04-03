<script lang="ts">
	import { untrack } from 'svelte';

	import { createCharacterCreationState } from '../../src/view/dialogs/characterCreation/state.svelte.js';

	let {
		ancestryOptions,
		backgroundOptions,
		classDocument,
		classOptions,
		backgroundDocument = null,
		alternateBackgroundDocument = null,
		ancestryDocument = null,
		spellIndex,
	}: {
		ancestryOptions: Record<'core' | 'exotic', NimbleAncestryItem[]>;
		backgroundOptions: NimbleBackgroundItem[];
		classDocument: NimbleClassItem | null;
		classOptions: NimbleClassItem[];
		backgroundDocument?: NimbleBackgroundItem | null;
		alternateBackgroundDocument?: NimbleBackgroundItem | null;
		ancestryDocument?: NimbleAncestryItem | null;
		spellIndex: import('#utils/getSpells.js').SpellIndex;
	} = $props();

	const state = createCharacterCreationState({
		ancestryOptions: Promise.resolve(untrack(() => ancestryOptions)),
		backgroundOptions: Promise.resolve(untrack(() => backgroundOptions)),
		classFeatureIndex: Promise.resolve(new Map()),
		classOptions: Promise.resolve(untrack(() => classOptions)),
		dialog: {
			id: 'character-creation-dialog',
			submitCharacterCreation: async () => undefined,
		},
		spellIndex: Promise.resolve(untrack(() => spellIndex)),
	});

	function selectClass() {
		if (classDocument) {
			state.selectedClass = classDocument;
		}
	}

	function selectAncestry() {
		if (ancestryDocument) {
			state.selectedAncestry = ancestryDocument;
		}
	}

	function selectBackground() {
		if (backgroundDocument) {
			state.selectedBackground = backgroundDocument;
		}
	}

	function selectAlternateBackground() {
		if (alternateBackgroundDocument) {
			state.selectedBackground = alternateBackgroundDocument;
		}
	}

	function completeClassSchoolSelection() {
		const group = state.spellGrants?.schoolSelections.find((entry) => entry.source === 'class');
		if (!group) return;

		const nextSchools = new Map(state.selectedSchools);
		nextSchools.set(
			group.ruleId,
			group.availableSchools.slice(0, Math.min(group.count, group.availableSchools.length)),
		);
		state.selectedSchools = nextSchools;

		const nextConfirmed = new Set(state.confirmedSchools);
		nextConfirmed.add(group.ruleId);
		state.confirmedSchools = nextConfirmed;
	}

	function completeBackgroundSpellSelection() {
		const group = state.spellGrants?.spellSelections.find((entry) => entry.source === 'background');
		if (!group) return;

		const nextSpells = new Map(state.selectedSpells);
		nextSpells.set(
			group.ruleId,
			group.availableSpells
				.slice(0, Math.min(group.count, group.availableSpells.length))
				.map((spell) => spell.uuid),
		);
		state.selectedSpells = nextSpells;
	}

	function completeBackgroundSchoolSelection() {
		const group = state.spellGrants?.schoolSelections.find(
			(entry) => entry.source === 'background',
		);
		if (!group) return;

		const nextSchools = new Map(state.selectedSchools);
		nextSchools.set(
			group.ruleId,
			group.availableSchools.slice(0, Math.min(group.count, group.availableSchools.length)),
		);
		state.selectedSchools = nextSchools;

		const nextConfirmed = new Set(state.confirmedSchools);
		nextConfirmed.add(group.ruleId);
		state.confirmedSchools = nextConfirmed;
	}
</script>

<button type="button" onclick={selectClass}>Select Class</button>
<button type="button" onclick={selectAncestry}>Select Ancestry</button>
<button type="button" onclick={selectBackground}>Select Background</button>
<button type="button" onclick={selectAlternateBackground}>Select Alternate Background</button>
<button type="button" onclick={completeClassSchoolSelection}>Complete Class School Selection</button
>
<button type="button" onclick={completeBackgroundSchoolSelection}>
	Complete Background School Selection
</button>
<button type="button" onclick={completeBackgroundSpellSelection}>
	Complete Background Spell Selection
</button>

<div data-testid="stage">{String(state.stage)}</div>
<div data-testid="active-spell-selection-source">{String(state.activeSpellSelectionSource)}</div>
<div data-testid="spell-grants">{JSON.stringify(state.spellGrants)}</div>
<div data-testid="selected-schools">{JSON.stringify([...state.selectedSchools.entries()])}</div>
<div data-testid="selected-spells">{JSON.stringify([...state.selectedSpells.entries()])}</div>
<div data-testid="confirmed-schools">{JSON.stringify([...state.confirmedSchools])}</div>
