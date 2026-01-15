<script lang="ts">
	import { setContext } from 'svelte';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';
	import prepareRollTooltip from '../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';

	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CardHeader from './components/CardHeader.svelte';
	import RollSummary from './components/RollSummary.svelte';

	let { messageDocument } = $props();
	let { system, rolls } = messageDocument;

	const {
		actorType,
		permissions,
		restType,
		hitDiceSpent,
		totalHealing,
		wasMaximized,
		hadAdvantage,
		advantageSource,
	} = system;

	const headerBackgroundColor = messageDocument.author.color;
	const headerTextColor = calculateHeaderTextColor(headerBackgroundColor);

	// Determine rest type label and icon
	const isMakeCamp = restType === 'makeCamp';
	const restTypeLabel = isMakeCamp
		? CONFIG.NIMBLE.fieldRest.makeCamp
		: CONFIG.NIMBLE.fieldRest.catchBreath;
	const restLabel = game.i18n.format(CONFIG.NIMBLE.fieldRest.cardHeading, {
		restType: restTypeLabel,
	});
	const restIcon = isMakeCamp ? 'fa-solid fa-campground' : 'fa-solid fa-wind';

	// Format hit dice spent for display
	const hitDiceDisplay = Object.entries(hitDiceSpent as Record<string, number>)
		.filter(([_, qty]) => qty > 0)
		.map(([size, qty]) => `${qty}d${size}`)
		.join(' + ');

	// Prepare roll tooltip if rolls exist
	const rollTooltip = rolls?.length ? prepareRollTooltip(actorType, permissions, rolls[0]) : '';

	setContext('message', messageDocument);
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
		{:else if !hitDiceDisplay}
			<div class="no-dice-message">{CONFIG.NIMBLE.fieldRest.restedWithoutSpending}</div>
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
			color: hsl(45, 70%, 40%);
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
			background: hsla(120, 45%, 45%, 0.15);
			color: hsl(120, 45%, 35%);
			border: 1px solid hsla(120, 45%, 45%, 0.3);
		}

		&--advantage {
			background: hsla(210, 70%, 50%, 0.15);
			color: hsl(210, 70%, 40%);
			border: 1px solid hsla(210, 70%, 50%, 0.3);
		}

		&__source {
			font-weight: 500;
			font-style: italic;
			opacity: 0.8;
		}
	}

	:global(.theme-dark) .modifier-badge {
		&--maximize {
			background: hsla(120, 45%, 45%, 0.2);
			color: hsl(120, 50%, 60%);
			border-color: hsla(120, 45%, 45%, 0.4);
		}

		&--advantage {
			background: hsla(210, 70%, 50%, 0.2);
			color: hsl(210, 70%, 65%);
			border-color: hsla(210, 70%, 50%, 0.4);
		}
	}

	:global(.theme-dark) .hit-dice-spent {
		&__label {
			color: hsl(0, 0%, 70%);
		}

		&__value {
			color: hsl(45, 80%, 60%);
		}
	}

	:global(.theme-dark) .no-dice-message {
		color: hsl(0, 0%, 70%);
	}
</style>
