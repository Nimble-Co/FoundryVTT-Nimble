<script lang="ts">
	import { setContext } from 'svelte';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

	import CardBodyHeader from './components/CardBodyHeader.svelte';
	import CardHeader from './components/CardHeader.svelte';

	let { messageDocument } = $props();
	let { system } = messageDocument;

	const { hitDiceRecovered, hpRestored, tempHpRemoved, manaRestored, woundsRecovered } = system;

	const headerBackgroundColor = messageDocument.author.color;
	const headerTextColor = calculateHeaderTextColor(headerBackgroundColor);

	// Format hit dice recovered for display
	const hitDiceDisplay = Object.entries(hitDiceRecovered as Record<string, number>)
		.filter(([_, qty]) => qty > 0)
		.map(([size, qty]) => `${qty}d${size}`)
		.join(', ');

	// Check if anything was recovered
	const hasRecovery = hitDiceDisplay || hpRestored > 0 || manaRestored > 0 || woundsRecovered > 0;

	setContext('message', messageDocument);
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<CardBodyHeader
		fa={true}
		image="fa-solid fa-bed"
		heading="Safe Rest"
		subheading="Full Recovery"
	/>

	<section class="nimble-card-section safe-rest-card">
		{#if hasRecovery}
			<div class="recovery-list">
				{#if hpRestored > 0}
					<div class="recovery-item">
						<i class="recovery-item__icon fa-solid fa-heart"></i>
						<span class="recovery-item__label">HP Restored</span>
						<span class="recovery-item__value recovery-item__value--hp">+{hpRestored}</span>
					</div>
				{/if}

				{#if tempHpRemoved > 0}
					<div class="recovery-item recovery-item--removed">
						<i class="recovery-item__icon fa-solid fa-heart-crack"></i>
						<span class="recovery-item__label">Temp HP Removed</span>
						<span class="recovery-item__value">-{tempHpRemoved}</span>
					</div>
				{/if}

				{#if manaRestored > 0}
					<div class="recovery-item">
						<i class="recovery-item__icon fa-solid fa-sparkles"></i>
						<span class="recovery-item__label">Mana Restored</span>
						<span class="recovery-item__value recovery-item__value--mana">+{manaRestored}</span>
					</div>
				{/if}

				{#if hitDiceDisplay}
					<div class="recovery-item">
						<i class="recovery-item__icon fa-solid fa-dice-d20"></i>
						<span class="recovery-item__label">Hit Dice Recovered</span>
						<span class="recovery-item__value recovery-item__value--dice">{hitDiceDisplay}</span>
					</div>
				{/if}

				{#if woundsRecovered > 0}
					<div class="recovery-item">
						<i class="recovery-item__icon fa-solid fa-bandage"></i>
						<span class="recovery-item__label">Wounds Healed</span>
						<span class="recovery-item__value recovery-item__value--wounds">{woundsRecovered}</span>
					</div>
				{/if}
			</div>
		{:else}
			<div class="no-recovery-message">Already fully rested</div>
		{/if}
	</section>
</article>

<style lang="scss">
	.safe-rest-card {
		padding: 0.5rem;
	}

	.recovery-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.recovery-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;

		&--removed {
			opacity: 0.7;
		}

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

			&--hp {
				color: hsl(0, 65%, 45%);
			}

			&--mana {
				color: hsl(220, 70%, 50%);
			}

			&--dice {
				color: hsl(45, 70%, 40%);
			}

			&--wounds {
				color: hsl(30, 70%, 45%);
			}
		}
	}

	.no-recovery-message {
		font-size: var(--nimble-sm-text);
		font-style: italic;
		color: var(--nimble-medium-text-color);
		text-align: center;
		padding: 0.5rem;
	}

	:global(.theme-dark) .recovery-item {
		&__label {
			color: var(--nimble-light-text-color);
		}

		&__value {
			&--hp {
				color: hsl(0, 65%, 60%);
			}

			&--mana {
				color: hsl(220, 70%, 65%);
			}

			&--dice {
				color: hsl(45, 70%, 55%);
			}

			&--wounds {
				color: hsl(30, 70%, 60%);
			}
		}
	}
</style>
