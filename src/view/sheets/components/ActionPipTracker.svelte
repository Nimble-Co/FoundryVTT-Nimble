<script>
	import { untrack } from 'svelte';
	import localize from '../../../utils/localize.js';

	const diceIcons = [
		'fa-dice-one',
		'fa-dice-two',
		'fa-dice-three',
		'fa-dice-four',
		'fa-dice-five',
		'fa-dice-six',
	];

	function getDiceIcon(index) {
		if (index < diceIcons.length) {
			return diceIcons[index];
		}
		return 'fa-dice-d6';
	}

	function handlePipClick(index) {
		if (disabled) return;

		const pipNumber = index + 1;

		if (pipNumber <= current) {
			onUpdate(index);
		} else {
			onUpdate(pipNumber);
		}
	}

	function getAriaLabel(index, isAvailable) {
		const number = index + 1;
		if (isAvailable) {
			return localize('NIMBLE.ui.heroicActions.pip.spendAction', { number });
		}
		return localize('NIMBLE.ui.heroicActions.pip.restoreAction', { number });
	}

	function getTooltip(isAvailable) {
		if (disabled) {
			return localize('NIMBLE.ui.heroicActions.enterCombat');
		}
		if (isAvailable) {
			return localize('NIMBLE.ui.heroicActions.pip.clickToSpend');
		}
		return localize('NIMBLE.ui.heroicActions.pip.clickToRestore');
	}

	let { current = 0, max = 3, disabled = false, onUpdate = () => {} } = $props();

	// Track which pips were just spent for animation
	let justSpentPips = $state(new Set());
	let previousCurrent = $state(untrack(() => current));

	// Detect when pips are spent and trigger animation
	$effect(() => {
		if (current < previousCurrent) {
			// Pips were spent - mark them for animation
			const newlySpent = new Set();
			for (let i = current; i < previousCurrent; i++) {
				newlySpent.add(i);
			}
			justSpentPips = newlySpent;

			// Clear the animation class after the animation completes
			setTimeout(() => {
				justSpentPips = new Set();
			}, 600);
		}
		previousCurrent = current;
	});
</script>

<div class="action-pip-tracker" class:action-pip-tracker--disabled={disabled}>
	<header class="nimble-section-header" data-header-alignment="center">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.ui.heroicActions.actionsHeader')}
		</h3>
		<span class="action-pip-tracker__count">{current} / {max}</span>
	</header>

	<div class="action-pip-tracker__pips">
		{#each { length: max }, i}
			{@const isAvailable = i < current}
			{@const isJustSpent = justSpentPips.has(i)}
			{@const diceIcon = getDiceIcon(i)}

			<button
				class="action-pip"
				class:action-pip--available={isAvailable}
				class:action-pip--spent={!isAvailable}
				class:action-pip--just-spent={isJustSpent}
				type="button"
				aria-label={getAriaLabel(i, isAvailable)}
				data-tooltip={getTooltip(isAvailable)}
				onclick={() => handlePipClick(i)}
				{disabled}
			>
				<i class="action-pip__icon fa-solid {diceIcon}"></i>
			</button>
		{/each}
	</div>
</div>

<style lang="scss">
	.action-pip-tracker {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;

		&--disabled {
			.action-pip {
				cursor: not-allowed;

				&:hover {
					transform: none;
					box-shadow: none;
				}
			}
		}

		&__count {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
		}

		&__pips {
			display: flex;
			gap: 0.5rem;
		}
	}

	.action-pip {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		background: var(--nimble-box-background-color);
		border: 2px solid var(--nimble-card-border-color);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;

		&:hover:not(:disabled) {
			border-color: var(--nimble-accent-color);
		}

		&:disabled {
			cursor: not-allowed;
		}

		// Available actions: green icon
		&--available {
			.action-pip__icon {
				color: hsl(139, 47%, 44%);
			}

			&:hover:not(:disabled) .action-pip__icon {
				color: hsl(139, 47%, 55%);
				filter: drop-shadow(0 0 4px hsl(139, 47%, 44%));
			}
		}

		// Spent actions: gray icon
		&--spent {
			.action-pip__icon {
				color: var(--nimble-medium-text-color);
				opacity: 0.5;
			}

			&:hover:not(:disabled) .action-pip__icon {
				opacity: 0.7;
			}
		}

		// Animation when pip is just spent
		&--just-spent {
			animation: pip-spent 0.6s ease-out;

			.action-pip__icon {
				animation: pip-icon-spent 0.6s ease-out;
			}
		}

		&__icon {
			font-size: 1.25rem;
			transition: all 0.15s ease;
		}
	}

	@keyframes pip-spent {
		0% {
			transform: scale(1);
			border-color: hsl(139, 47%, 44%);
		}
		30% {
			transform: scale(1.15);
			border-color: hsl(45, 70%, 50%);
		}
		100% {
			transform: scale(1);
			border-color: var(--nimble-card-border-color);
		}
	}

	@keyframes pip-icon-spent {
		0% {
			color: hsl(139, 47%, 44%);
			opacity: 1;
			transform: scale(1);
		}
		30% {
			color: hsl(45, 70%, 50%);
			opacity: 1;
			transform: scale(1.2);
		}
		100% {
			color: var(--nimble-medium-text-color);
			opacity: 0.5;
			transform: scale(1);
		}
	}

	:global(.theme-dark) .action-pip {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&:hover:not(:disabled) {
			border-color: hsl(220, 15%, 45%);
			background: hsl(220, 15%, 22%);
		}
	}
</style>
