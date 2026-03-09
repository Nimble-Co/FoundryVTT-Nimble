<script>
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
			{@const diceIcon = getDiceIcon(i)}

			<button
				class="action-pip"
				class:action-pip--available={isAvailable}
				class:action-pip--spent={!isAvailable}
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
			opacity: 0.6;
		}

		&__count {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
		}

		&__pips {
			display: flex;
			gap: 0.375rem;
		}
	}

	.action-pip {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: var(--nimble-standard-transition);

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

		// Spent actions: dimmed
		&--spent {
			opacity: 0.4;

			&:hover:not(:disabled) {
				opacity: 0.6;
			}

			.action-pip__icon {
				color: var(--nimble-medium-text-color);
			}
		}

		&__icon {
			font-size: 1.5rem;
			transition: var(--nimble-standard-transition);
		}
	}
</style>
