<script lang="ts">
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import prepareRollTooltip from '../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';

	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import RollSummary from './components/RollSummary.svelte';

	let { messageDocument } = $props();

	const system = $derived(messageDocument.reactive.system);
	const rolls = $derived(messageDocument.reactive.rolls);
	const actorType = $derived(system.actorType);
	const permissions = $derived(system.permissions);
	const restType = $derived(system.restType);
	const hitDiceSpent = $derived(system.hitDiceSpent);
	const totalHealing = $derived(system.totalHealing);
	const wasMaximized = $derived(system.wasMaximized);
	const hadAdvantage = $derived(system.hadAdvantage);
	const advantageSource = $derived(system.advantageSource);
	const manaRestored = $derived(system.manaRestored);

	const headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	// Determine rest type label and icon
	const isMakeCamp = $derived(restType === 'makeCamp');
	const restTypeLabel = $derived(
		isMakeCamp ? CONFIG.NIMBLE.fieldRest.makeCamp : CONFIG.NIMBLE.fieldRest.catchBreath,
	);
	const restLabel = $derived(
		game.i18n.format(CONFIG.NIMBLE.fieldRest.cardHeading, {
			restType: restTypeLabel,
		}),
	);
	const restIcon = $derived(isMakeCamp ? 'fa-solid fa-campground' : 'fa-solid fa-wind');

	// Format hit dice spent for display
	const hitDiceDisplay = $derived(
		Object.entries(hitDiceSpent as Record<string, number>)
			.filter(([_, qty]) => qty > 0)
			.map(([size, qty]) => `${qty}d${size}`)
			.join(' + '),
	);

	// Prepare roll tooltip if rolls exist
	const rollTooltip = $derived(
		rolls?.length ? prepareRollTooltip(actorType, permissions, rolls[0]) : '',
	);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<CardBodyHeader fa={true} image={restIcon} heading={restLabel} />

	<section class="nimble-card-section">
		{#if hitDiceDisplay}
			<div class="hit-dice-spent">
				<span class="hit-dice-spent__label">{CONFIG.NIMBLE.fieldRest.hitDice}</span>
				<span class="hit-dice-spent__value">{hitDiceDisplay}</span>
			</div>
		{/if}

		{#if rolls?.length && totalHealing > 0}
			<RollSummary
				label={CONFIG.NIMBLE.fieldRest.healing}
				subheading={wasMaximized
					? CONFIG.NIMBLE.fieldRest.maximized
					: hadAdvantage
						? CONFIG.NIMBLE.fieldRest.withAdvantage
						: CONFIG.NIMBLE.fieldRest.rolled}
				tooltip={rollTooltip}
				total={totalHealing}
			/>
		{:else if !hitDiceDisplay && !manaRestored}
			<div class="no-dice-message">{CONFIG.NIMBLE.fieldRest.restedWithoutSpending}</div>
		{/if}

		{#if manaRestored > 0}
			<div class="mana-restored">
				<i class="mana-restored__icon fa-solid fa-sparkles"></i>
				<span class="mana-restored__label">{CONFIG.NIMBLE.fieldRest.manaRestored}</span>
				<span class="mana-restored__value">+{manaRestored}</span>
			</div>
		{/if}

		{#if wasMaximized || hadAdvantage}
			<div class="modifiers-applied">
				{#if wasMaximized}
					<span class="modifier-badge modifier-badge--maximize">
						<i class="fa-solid fa-arrow-up"></i>
						{CONFIG.NIMBLE.fieldRest.maximized}
					</span>
				{/if}
				{#if hadAdvantage}
					<span class="modifier-badge modifier-badge--advantage">
						<i class="fa-solid fa-dice-d20"></i>
						{CONFIG.NIMBLE.fieldRest.advantage}
						{#if advantageSource}
							<span class="modifier-badge__source">({advantageSource})</span>
						{/if}
					</span>
				{/if}
			</div>
		{/if}
	</section>
</article>

<style lang="scss">
	.nimble-card-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
	}

	.hit-dice-spent {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;

		&__label {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.03em;
			color: var(--nimble-medium-text-color);
		}

		&__value {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-chat-hit-dice-value-color);
		}
	}

	.mana-restored {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;

		&__icon {
			width: 1rem;
			text-align: center;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__label {
			flex: 1;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
		}

		&__value {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: var(--nimble-chat-mana-value-color);
		}
	}

	.no-dice-message {
		font-size: var(--nimble-sm-text);
		font-style: italic;
		color: var(--nimble-medium-text-color);
		text-align: center;
		padding: 0.5rem;
	}

	.modifiers-applied {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.25rem;
	}

	.modifier-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.1875rem 0.5rem;
		font-size: var(--nimble-xs-text);
		font-weight: 600;
		border-radius: 3px;

		&--maximize {
			background: var(--nimble-chat-maximize-background);
			color: var(--nimble-chat-maximize-color);
			border: 1px solid var(--nimble-chat-maximize-border-color);
		}

		&--advantage {
			background: var(--nimble-chat-advantage-background);
			color: var(--nimble-chat-advantage-color);
			border: 1px solid var(--nimble-chat-advantage-border-color);
		}

		&__source {
			font-weight: 500;
			font-style: italic;
			opacity: 0.8;
		}
	}
</style>
