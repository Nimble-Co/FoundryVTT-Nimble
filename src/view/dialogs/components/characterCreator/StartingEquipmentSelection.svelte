<script>
	import { getContext } from 'svelte';
	import Hint from '../../../components/Hint.svelte';

	let {
		active,
		selectedClass,
		selectedBackground,
		startingEquipmentChoice = $bindable(),
	} = $props();

	const CHARACTER_CREATION_STAGES = getContext('CHARACTER_CREATION_STAGES');
	const dialog = getContext('dialog');
	const { startingEquipment, characterCreationStages } = CONFIG.NIMBLE;

	const hintText = game.i18n.localize(startingEquipment.hint);

	// Get grantItem rules from selected class and background
	let equipmentRules = $derived.by(() => {
		const rules = [];

		if (selectedClass?.rules) {
			for (const rule of selectedClass.rules.values()) {
				if (rule.type === 'grantItem' && !rule.disabled) {
					rules.push(rule);
				}
			}
		}

		if (selectedBackground?.rules) {
			for (const rule of selectedBackground.rules.values()) {
				if (rule.type === 'grantItem' && !rule.disabled) {
					rules.push(rule);
				}
			}
		}

		return rules;
	});

	function selectEquipment() {
		startingEquipmentChoice = 'equipment';
	}

	function selectGold() {
		startingEquipmentChoice = 'gold';
	}
</script>

<section
	class="nimble-character-creation-section"
	id="{dialog.id}-stage-{CHARACTER_CREATION_STAGES.STARTING_EQUIPMENT}"
>
	<header class="nimble-section-header" data-header-variant="character-creator">
		<h3 class="nimble-heading" data-heading-variant="section">
			{game.i18n.localize(characterCreationStages.stepFourStartingEquipment)}

			{#if !active && startingEquipmentChoice}
				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label={game.i18n.localize(startingEquipment.editSelection)}
					data-tooltip={game.i18n.localize(startingEquipment.editSelection)}
					onclick={() => (startingEquipmentChoice = null)}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			{/if}
		</h3>
	</header>

	{#if active}
		<Hint {hintText} />

		<div class="starting-equipment-options">
			<button class="starting-equipment-option" onclick={selectEquipment}>
				<i class="option-icon fa-solid fa-box-open"></i>
				<span class="option-title">
					{game.i18n.localize(startingEquipment.equipmentTitle)}
				</span>
				<p class="option-description">
					{game.i18n.localize(startingEquipment.equipmentDescription)}
				</p>
				{#if equipmentRules.length > 0}
					<ul class="equipment-list">
						{#each equipmentRules as rule}
							<li>
								{rule.label ||
									game.i18n.localize(startingEquipment.unknownItem)}{#if rule.quantity > 1}
									({rule.quantity}){/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="no-equipment">{game.i18n.localize(startingEquipment.noEquipmentDefined)}</p>
				{/if}
			</button>

			<button class="starting-equipment-option" onclick={selectGold}>
				<i class="option-icon fa-solid fa-coins"></i>
				<span class="option-title">
					{game.i18n.localize(startingEquipment.goldTitle)}
				</span>
				<p class="option-description">
					{game.i18n.localize(startingEquipment.goldDescription)}
				</p>
			</button>
		</div>
	{:else if startingEquipmentChoice === 'equipment'}
		<div class="selected-choice">
			<i class="fa-solid fa-box-open"></i>
			<span>{game.i18n.localize(startingEquipment.equipmentSelected)}</span>
		</div>
	{:else if startingEquipmentChoice === 'gold'}
		<div class="selected-choice">
			<i class="fa-solid fa-coins"></i>
			<span>{game.i18n.localize(startingEquipment.goldSelected)}</span>
		</div>
	{/if}
</section>

<style lang="scss">
	.starting-equipment-options {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		align-items: stretch;
		gap: 1rem;
		padding: 0.5rem;
	}

	.starting-equipment-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		height: 100%;
		padding: 1rem;
		color: var(--nimble-dark-text-color);
		background: var(--nimble-input-background-color);
		border: 1px solid var(--nimble-input-border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: var(--nimble-standard-transition);

		&:hover {
			border-color: var(--nimble-dark-text-color);
			box-shadow: var(--nimble-box-shadow);
		}
	}

	.option-icon {
		font-size: 1.5rem;
		color: var(--nimble-dark-text-color);
	}

	.option-title {
		font-size: var(--nimble-lg-text);
		font-weight: 600;
	}

	.option-description {
		margin: 0;
		font-size: var(--nimble-sm-text);
		color: var(--nimble-medium-text-color);
	}

	.equipment-list {
		width: 100%;
		margin: 0.5rem 0 0;
		padding: 0.5rem 0.75rem 0.5rem 1.5rem;
		list-style: disc;
		text-align: left;
		font-size: var(--nimble-sm-text);
		background: var(--nimble-hint-background-color);
		border: 1px solid var(--nimble-hint-border-color);
		border-radius: 4px;

		li {
			margin: 0.125rem 0;
		}
	}

	.no-equipment {
		margin: 0.5rem 0 0;
		font-size: var(--nimble-sm-text);
		font-style: italic;
		color: var(--nimble-medium-text-color);
	}

	.selected-choice {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		color: var(--nimble-dark-text-color);
		background: var(--nimble-input-background-color);
		border: 1px solid var(--nimble-input-border-color);
		border-radius: 4px;
	}
</style>
