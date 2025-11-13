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

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');

	const { sizeCategories } = CONFIG.NIMBLE;

	const hintText = 'Select a size category for your character from the options listed below.';

	let { active, selectedAncestry, selectedAncestrySize = $bindable() } = $props();
</script>

{#if selectedAncestry?.system?.size?.length > 1}
	<section
		class="nimble-character-creation-section"
		id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.ANCESTRY_SIZE}"
	>
		<header class="nimble-section-header" data-header-variant="character-creator">
			<h3 class="nimble-heading" data-heading-variant="section">
				Step 2.1. Select Your Size Category
			</h3>
		</header>

		{#if active}
			<Hint {hintText} />
		{/if}

		<div class="nimble-character-creation-section__body">
			<TagGroup
				options={prepareAncestrySizeOptions(selectedAncestry)}
				selectedOptions={[selectedAncestrySize]}
				toggleOption={(sizeCategory) => (selectedAncestrySize = sizeCategory)}
			/>
		</div>
	</section>
{/if}
