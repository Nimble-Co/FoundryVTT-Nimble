<script>
	import { getContext } from 'svelte';

	import Hint from '../../../components/Hint.svelte';
	import TagGroup from '../../../components/TagGroup.svelte';

	function prepareAncestrySizeOptions(ancestry) {
		return ancestry?.system?.size?.map((sizeCategory) => ({
			value: sizeCategory,
			label: sizeCategories[sizeCategory] ?? sizeCategory,
		}));
	}

	function ancestryRequiresSaveChoice(ancestry) {
		const rules = [...(ancestry?.rules?.values() ?? [])];
		if (!rules.length) return false;

		for (const rule of rules) {
			if (rule.type === 'savingThrowRollMode' && rule.requiresChoice && rule.target === 'neutral') {
				return true;
			}
		}

		return false;
	}

	function getNeutralSaves(selectedClass) {
		if (!selectedClass) return [];

		const savingThrowKeys = Object.keys(CONFIG.NIMBLE.savingThrows);
		const classAdvantage = selectedClass.system?.savingThrows?.advantage;
		const classDisadvantage = selectedClass.system?.savingThrows?.disadvantage;

		return savingThrowKeys.filter((key) => key !== classAdvantage && key !== classDisadvantage);
	}

	function prepareSaveOptions(selectedClass) {
		const neutralSaves = getNeutralSaves(selectedClass);
		const { savingThrows } = CONFIG.NIMBLE;

		return neutralSaves.map((saveKey) => ({
			value: saveKey,
			label: savingThrows[saveKey] ?? saveKey,
		}));
	}

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const { sizeCategories } = CONFIG.NIMBLE;

	const sizeHintText = 'Select a size category for your character from the options listed below.';
	const saveHintText =
		'Your ancestry grants you an enhanced saving throw. Select which of your neutral saves you would like to become advantaged.';

	let {
		active,
		selectedAncestry,
		selectedClass,
		selectedAncestrySize = $bindable(),
		selectedAncestrySave = $bindable(),
	} = $props();

	let hasSizeChoice = $derived(selectedAncestry?.system?.size?.length > 1);
	let hasSaveChoice = $derived(ancestryRequiresSaveChoice(selectedAncestry));
	let hasAnyChoice = $derived(hasSizeChoice || hasSaveChoice);
</script>

{#if hasAnyChoice}
	<section
		class="nimble-character-creation-section"
		id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.ANCESTRY_OPTIONS}"
	>
		<header class="nimble-section-header" data-header-variant="character-creator">
			<h3 class="nimble-heading" data-heading-variant="section">Step 2.1. Ancestry Options</h3>
		</header>

		{#if hasSizeChoice}
			<div class="nimble-character-creation-section__subsection">
				<h4 class="nimble-heading" data-heading-variant="subsection">Size Category</h4>
				{#if active}
					<Hint hintText={sizeHintText} />
				{/if}
				<div class="nimble-character-creation-section__body">
					<TagGroup
						options={prepareAncestrySizeOptions(selectedAncestry)}
						selectedOptions={[selectedAncestrySize]}
						toggleOption={(sizeCategory) => (selectedAncestrySize = sizeCategory)}
					/>
				</div>
			</div>
		{/if}

		{#if hasSaveChoice && selectedClass}
			<div class="nimble-character-creation-section__subsection">
				<h4 class="nimble-heading" data-heading-variant="subsection">Enhanced Save</h4>
				{#if active}
					<Hint hintText={saveHintText} />
				{/if}
				<div class="nimble-character-creation-section__body">
					<TagGroup
						options={prepareSaveOptions(selectedClass)}
						selectedOptions={selectedAncestrySave ? [selectedAncestrySave] : []}
						toggleOption={(saveKey) => (selectedAncestrySave = saveKey)}
					/>
				</div>
			</div>
		{/if}
	</section>
{/if}
