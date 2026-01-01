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

	const hintText =
		'Heroes start with the equipment listed for their class and background OR 50 gp to buy their starting equipment. If starting at a higher level, multiply that by the level you are starting at.';

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
			Step 4. Starting Equipment

			{#if !active && startingEquipmentChoice}
				<button
					class="nimble-button"
					data-button-variant="icon"
					aria-label="Edit Starting Equipment Selection"
					data-tooltip="Edit Starting Equipment Selection"
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
			<button class="nimble-card starting-equipment-option" onclick={selectEquipment}>
				<i class="nimble-card__icon fa-solid fa-box-open"></i>
				<h4 class="nimble-card__title nimble-heading">Starting Equipment</h4>
				<div class="nimble-card__description">
					<p>Receive the following items:</p>
					{#if equipmentRules.length > 0}
						<ul class="equipment-list">
							{#each equipmentRules as rule}
								<li>{rule.label || 'Unknown Item'}</li>
							{/each}
						</ul>
					{:else}
						<p><em>No starting equipment defined</em></p>
					{/if}
				</div>
			</button>

			<button class="nimble-card starting-equipment-option" onclick={selectGold}>
				<i class="nimble-card__icon fa-solid fa-coins"></i>
				<h4 class="nimble-card__title nimble-heading">Starting Gold</h4>
				<div class="nimble-card__description">
					<p>Receive <strong>50 gp</strong> to purchase your own equipment.</p>
					<p class="hint"><em>(Multiply by starting level if higher than 1)</em></p>
				</div>
			</button>
		</div>
	{:else if startingEquipmentChoice === 'equipment'}
		<div class="selected-choice">
			<i class="fa-solid fa-box-open"></i>
			<span>Starting Equipment Selected</span>
		</div>
	{:else if startingEquipmentChoice === 'gold'}
		<div class="selected-choice">
			<i class="fa-solid fa-coins"></i>
			<span>Starting Gold (50 gp) Selected</span>
		</div>
	{/if}
</section>

<style lang="scss">
	.starting-equipment-options {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		padding: 0.5rem;
	}

	.starting-equipment-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			transform: translateY(-2px);
			box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
		}
	}

	.nimble-card__icon {
		font-size: 2rem;
		margin-bottom: 0.5rem;
		color: var(--nimble-primary-color, #c9a66b);
	}

	.equipment-list {
		list-style: disc;
		padding-left: 1.5rem;
		text-align: left;
		margin: 0.5rem 0;

		li {
			margin: 0.25rem 0;
		}
	}

	.hint {
		font-size: 0.85em;
		opacity: 0.8;
	}

	.selected-choice {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--nimble-card-background, rgba(0, 0, 0, 0.1));
		border-radius: 4px;
		border: 1px solid var(--nimble-card-border-color, hsl(41, 18%, 54%));

		i {
			color: var(--nimble-primary-color, #c9a66b);
		}
	}
</style>
