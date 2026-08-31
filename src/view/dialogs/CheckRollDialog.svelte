<script lang="ts">
	import type { CheckRollDialogProps } from '#types/components/CheckRollDialog.d.ts';

	import { untrack } from 'svelte';

	import { SYSTEM_ID } from '#system';
	import Hint from '#view/components/Hint.svelte';
	import getRollFormula from '../../utils/getRollFormula.js';
	import localize from '../../utils/localize.js';
	import {
		getSituationalRollModeOptions,
		type SituationalRollModeOption,
	} from './CheckRollDialog.utils.js';
	import RollModeConfig from './components/RollModeConfig.svelte';

	const { skillCheckDialog } = CONFIG.NIMBLE;

	let { actor, dialog, type = 'abilityCheck', ...data }: CheckRollDialogProps = $props();
	let selectedRollMode = $state(untrack(() => Math.clamp(Number(data.rollMode ?? 0), -6, 6)));
	let shouldRollBeHidden = $state(Boolean(game.settings.get(SYSTEM_ID, 'hideRolls')));

	// Rules are re-instantiated on every data-prep cycle, so the options are resolved
	// once for the life of the dialog rather than tracked reactively.
	const situationalOptions = untrack(() =>
		getSituationalRollModeOptions(actor, {
			type,
			abilityKey: data.abilityKey,
			saveKey: data.saveKey,
			skillKey: data.skillKey,
		}),
	);

	// Keyed by option, holding the adjustment actually applied to the slider rather
	// than the option's own value: clamping at the slider's ends can swallow part of
	// it, and unchecking has to give back exactly what checking took.
	let appliedAdjustments = $state<Record<string, number>>({});

	let rollFormula = $derived.by(() => {
		if (type === 'initiative') {
			return actor._getInitiativeFormula({ rollMode: selectedRollMode });
		}

		return getRollFormula(actor as Parameters<typeof getRollFormula>[0], {
			...data,
			rollMode: selectedRollMode,
			type,
		});
	});

	function isSelected(option: SituationalRollModeOption): boolean {
		return option.key in appliedAdjustments;
	}

	function toggleSituational(option: SituationalRollModeOption, checked: boolean): void {
		const next = { ...appliedAdjustments };

		if (checked) {
			const rollMode = Math.clamp(selectedRollMode + option.value, -6, 6);
			next[option.key] = rollMode - selectedRollMode;
			selectedRollMode = rollMode;
		} else {
			selectedRollMode = Math.clamp(selectedRollMode - (next[option.key] ?? 0), -6, 6);
			delete next[option.key];
		}

		appliedAdjustments = next;
	}

	function situationalLabel(value: number): string {
		if (value > 0) {
			return localize('NIMBLE.checkRollDialog.situationalRollMode.advantage', { count: value });
		}

		return localize('NIMBLE.checkRollDialog.situationalRollMode.disadvantage', {
			count: Math.abs(value),
		});
	}
</script>

<article class="nimble-sheet__body" style="--nimble-sheet-body-padding-block-start: 0.5rem">
	{#if data.checkHint}
		<Hint hintType="warning" hintIcon="fa-solid fa-circle-exclamation" hintText={data.checkHint} />
	{/if}

	<RollModeConfig bind:selectedRollMode />

	{#if situationalOptions.length}
		<section class="nimble-situational">
			<h5 class="nimble-situational__heading">
				{localize('NIMBLE.checkRollDialog.situationalRollMode.heading')}
			</h5>

			<ul class="nimble-situational__list">
				{#each situationalOptions as option (option.key)}
					<li>
						<label
							class="nimble-situational__option"
							class:nimble-situational__option--selected={isSelected(option)}
						>
							<i class="nimble-situational__icon {option.icon}" aria-hidden="true"></i>
							<span class="nimble-situational__label">{option.label}</span>
							<span
								class="nimble-situational__value"
								class:nimble-situational__value--penalty={option.value < 0}
							>
								{situationalLabel(option.value)}
							</span>
							<input
								type="checkbox"
								class="nimble-situational__checkbox"
								checked={isSelected(option)}
								onchange={(event) => toggleSituational(option, event.currentTarget.checked)}
							/>
						</label>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="nimble-check-roll-summary">
		<div class="nimble-roll-formula">{rollFormula}</div>

		{#if game.user?.isGM}
			<label class="nimble-hide-roll">
				<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>
				<span class="nimble-hide-roll__label">{skillCheckDialog.hideRoll}</span>
				<input
					type="checkbox"
					class="nimble-hide-roll__checkbox"
					bind:checked={shouldRollBeHidden}
				/>
			</label>
		{/if}
	</div>
</article>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		onclick={() =>
			dialog.submitRoll({
				rollMode: selectedRollMode,
				rollFormula,
				visibilityMode: shouldRollBeHidden ? 'blindroll' : 'publicroll',
			})}
	>
		<i class="nimble-button__icon fa-solid fa-dice-d20"></i>
		Roll
	</button>
</footer>

<style lang="scss">
	[data-button-variant='basic'] {
		--nimble-button-padding: 0.5rem;
		--nimble-button-width: 100%;
	}

	.nimble-situational {
		margin-block: 0.5rem 0.75rem;
		margin-inline: 1rem;
		padding: 0.625rem 0.75rem 0.75rem;
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;
		background: var(--nimble-card-background-color);

		&__heading {
			margin: 0 0 0.5rem;
			border: 0;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: var(--nimble-medium-text-color);
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__option {
			display: grid;
			grid-template-columns: 1.75rem 1fr auto auto;
			align-items: center;
			gap: 0.625rem;
			padding: 0.375rem 0.5rem;
			border: 1px solid transparent;
			border-radius: 4px;
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&:hover {
				background: hsla(var(--nimble-accent-color-values), 0.08);
			}

			&:focus-within {
				border-color: var(--nimble-accent-color);
			}

			&--selected {
				border-color: hsla(var(--nimble-accent-color-values), 0.5);
				background: hsla(var(--nimble-accent-color-values), 0.12);
			}
		}

		&__icon {
			display: grid;
			place-items: center;
			width: 1.75rem;
			height: 1.75rem;
			border-radius: 50%;
			background: hsla(var(--nimble-accent-color-values), 0.12);
			font-size: var(--nimble-md-text);
			color: var(--nimble-accent-color);
		}

		&__label {
			font-size: var(--nimble-sm-text);
			line-height: 1.2;
		}

		&__value {
			padding: 0.125rem 0.5rem;
			border-radius: 999px;
			background: hsla(var(--nimble-accent-color-values), 0.15);
			font-size: var(--nimble-xxs-text);
			font-weight: 700;
			letter-spacing: 0.04em;
			text-transform: uppercase;
			white-space: nowrap;
			color: var(--nimble-accent-color);

			&--penalty {
				background: hsla(0, 65%, 45%, 0.15);
				color: var(--nimble-validation-error-color);
			}
		}

		&__checkbox {
			width: 1rem;
			height: 1rem;
			margin: 0;
			cursor: pointer;
		}
	}

	.nimble-check-roll-summary {
		display: flex;
		align-items: stretch;
		gap: 0.5rem;
		margin-inline: 1rem;

		.nimble-roll-formula {
			flex: 1;
			display: grid;
			place-items: center;
		}
	}

	.nimble-hide-roll {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		background: var(--nimble-card-background-color);
		cursor: pointer;
		white-space: nowrap;
		color: var(--nimble-medium-text-color);

		&__label {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
		}

		&__checkbox {
			width: 1rem;
			height: 1rem;
			margin: 0;
			cursor: pointer;
		}
	}
</style>
