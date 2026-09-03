<script lang="ts">
	import { untrack } from 'svelte';

	import { createCharacterCreationState } from '../../src/view/dialogs/characterCreation/state.svelte.js';

	// Defaults to a one-entry list, i.e. the bonus pack is installed — the normal case, and the
	// only one in which the bonus stage gates at all. Pass `[]` for a missing or disabled pack.
	const INSTALLED_BONUS_PACK = [
		{ uuid: 'Compendium.nimble.nimble-ancestry-bonuses.Item.harness-bonus' },
	] as unknown as NimbleAncestryBonusItem[];

	let {
		ancestryOptions,
		ancestryBonusOptions = INSTALLED_BONUS_PACK,
		backgroundOptions,
		classDocument,
		classOptions,
		backgroundDocument = null,
		alternateBackgroundDocument = null,
		ancestryDocument = null,
		alternateAncestryDocument = null,
		alternateAncestryBonus = null,
		ancestryVariant = null,
		statArray = null,
		abilityScoreAssignment = null,
		spellIndex,
		submitCharacterCreation = async () => undefined,
	}: {
		ancestryOptions: Record<'core' | 'exotic', NimbleAncestryItem[]>;
		ancestryBonusOptions?: NimbleAncestryBonusItem[];
		backgroundOptions: NimbleBackgroundItem[];
		classDocument: NimbleClassItem | null;
		classOptions: NimbleClassItem[];
		backgroundDocument?: NimbleBackgroundItem | null;
		alternateBackgroundDocument?: NimbleBackgroundItem | null;
		ancestryDocument?: NimbleAncestryItem | null;
		alternateAncestryDocument?: NimbleAncestryItem | null;
		alternateAncestryBonus?: NimbleAncestryBonusItem | null;
		ancestryVariant?: string | null;
		statArray?: import('#view/dialogs/characterCreation/types.js').StatArrayOption | null;
		abilityScoreAssignment?: Record<string, number | null> | null;
		spellIndex: import('#utils/getSpells.js').SpellIndex;
		submitCharacterCreation?: (
			results: import('#view/dialogs/characterCreation/types.js').CharacterCreationResults,
		) => Promise<void>;
	} = $props();

	const state = createCharacterCreationState({
		ancestryOptions: Promise.resolve(untrack(() => ancestryOptions)),
		ancestryBonusOptions: Promise.resolve(untrack(() => ancestryBonusOptions)),
		backgroundOptions: Promise.resolve(untrack(() => backgroundOptions)),
		classFeatureIndex: Promise.resolve(new Map()),
		classOptions: Promise.resolve(untrack(() => classOptions)),
		dialog: {
			id: 'character-creation-dialog',
			submitCharacterCreation: untrack(() => submitCharacterCreation),
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

	function selectAlternateAncestry() {
		if (alternateAncestryDocument) {
			state.selectedAncestry = alternateAncestryDocument;
		}
	}

	function clearAncestry() {
		state.selectedAncestry = null;
	}

	function selectAncestryVariant() {
		if (ancestryVariant) {
			state.selectedAncestryVariant = ancestryVariant;
		}
	}

	/** An incomplete character prompts for confirmation, so stub `DialogV2.confirm` before clicking. */
	async function submitCharacter() {
		state.name = 'Harness Character';
		await state.handleCreateCharacter();
	}

	function swapAncestryBonus() {
		if (alternateAncestryBonus) {
			state.selectedAncestryBonus = alternateAncestryBonus;
		}
	}

	function assignAbilityScores() {
		if (statArray) state.selectedArray = statArray;
		if (abilityScoreAssignment) state.selectedAbilityScores = abilityScoreAssignment;
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

	function confirmAncestryBonus() {
		state.ancestryBonusConfirmed = true;
	}

	function clearAncestryBonus() {
		state.selectedAncestryBonus = null;
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
<button type="button" onclick={selectAlternateAncestry}>Select Alternate Ancestry</button>
<button type="button" onclick={clearAncestry}>Clear Ancestry</button>
<button type="button" onclick={selectAncestryVariant}>Select Ancestry Variant</button>
<button type="button" onclick={submitCharacter}>Submit Character</button>
<button type="button" onclick={confirmAncestryBonus}>Confirm Ancestry Bonus</button>
<button type="button" onclick={clearAncestryBonus}>Clear Ancestry Bonus</button>
<button type="button" onclick={swapAncestryBonus}>Swap Ancestry Bonus</button>
<button type="button" onclick={assignAbilityScores}>Assign Ability Scores</button>
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
<div data-testid="selected-ancestry-bonus">{String(state.selectedAncestryBonus?.uuid ?? null)}</div>
<div data-testid="ancestry-bonus-confirmed">{String(state.ancestryBonusConfirmed)}</div>
<div data-testid="ancestry-options-available">{String(state.ancestryOptionsAvailable)}</div>
<div data-testid="selected-ancestry-variant">{String(state.selectedAncestryVariant)}</div>
<div data-testid="selected-ancestry-save">{String(state.selectedAncestrySave)}</div>
<!-- Both bonus maps seed every key at 0; only non-zero entries are interesting to assert. -->
<div data-testid="ability-bonuses">
	{JSON.stringify([...(state.abilityBonuses ?? [])].filter(([, value]) => value !== 0))}
</div>
<div data-testid="skill-bonuses">
	{JSON.stringify([...(state.skillBonuses ?? [])].filter(([, value]) => value !== 0))}
</div>
<div data-testid="granted-languages">{JSON.stringify(state.grantedLanguages)}</div>
<div data-testid="active-spell-selection-source">{String(state.activeSpellSelectionSource)}</div>
<div data-testid="spell-grants">{JSON.stringify(state.spellGrants)}</div>
<div data-testid="selected-schools">{JSON.stringify([...state.selectedSchools.entries()])}</div>
<div data-testid="selected-spells">{JSON.stringify([...state.selectedSpells.entries()])}</div>
<div data-testid="confirmed-schools">{JSON.stringify([...state.confirmedSchools])}</div>
