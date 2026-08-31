<script lang="ts">
	import type { CheckRollDialogProps } from '#types/components/CheckRollDialog.d.ts';

	import { untrack } from 'svelte';

	import { SYSTEM_ID } from '#system';
	import Hint from '#view/components/Hint.svelte';
	import getRollFormula from '../../utils/getRollFormula.js';
	import localize from '../../utils/localize.js';
	import { getSituationalRollModeOptions } from './CheckRollDialog.utils.js';
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

	let selectedSituationalKeys = $state<Record<string, boolean>>({});

	let situationalAdjustment = $derived(
		situationalOptions.reduce(
			(total, option) => (selectedSituationalKeys[option.key] ? total + option.value : total),
			0,
		),
	);

	let effectiveRollMode = $derived(Math.clamp(selectedRollMode + situationalAdjustment, -6, 6));

	let rollFormula = $derived.by(() => {
		if (type === 'initiative') {
			return actor._getInitiativeFormula({ rollMode: effectiveRollMode });
		}

		return getRollFormula(actor as Parameters<typeof getRollFormula>[0], {
			...data,
			rollMode: effectiveRollMode,
			type,
		});
	});

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
		<section class="nimble-situational-roll-mode">
			<h5 class="nimble-situational-roll-mode__heading">
				{localize('NIMBLE.checkRollDialog.situationalRollMode.heading')}
			</h5>

			{#each situationalOptions as option (option.key)}
				<label class="nimble-situational-roll-mode__option">
					<input
						type="checkbox"
						class="modifier-item__checkbox"
						checked={selectedSituationalKeys[option.key] ?? false}
						onchange={(event) => {
							selectedSituationalKeys = {
								...selectedSituationalKeys,
								[option.key]: event.currentTarget.checked,
							};
						}}
					/>
					<i class="nimble-situational-roll-mode__icon {option.icon}" aria-hidden="true"></i>
					<span class="nimble-situational-roll-mode__label">{option.label}</span>
					<span
						class="nimble-situational-roll-mode__value"
						class:nimble-situational-roll-mode__value--penalty={option.value < 0}
					>
						{situationalLabel(option.value)}
					</span>
				</label>
			{/each}
		</section>
	{/if}

	{#if game.user?.isGM}
		<section class="nimble-gm-roll-options">
			<label class="nimble-gm-roll-options__option">
				<i class="fa-solid fa-user-secret nimble-gm-roll-options__icon" aria-hidden="true"></i>
				<span class="nimble-gm-roll-options__label">{skillCheckDialog.hideRoll}</span>
				<input type="checkbox" bind:checked={shouldRollBeHidden} class="modifier-item__checkbox" />
			</label>
		</section>
	{/if}
	<div class="nimble-roll-formula">{rollFormula}</div>
</article>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		onclick={() =>
			dialog.submitRoll({
				rollMode: effectiveRollMode,
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

	.nimble-situational-roll-mode {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin-top: 0.75rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		background: var(--nimble-card-background-color);

		&__heading {
			margin: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--nimble-medium-text-color);
		}

		&__option {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			cursor: pointer;
		}

		&__icon {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__label {
			flex: 1;
		}

		&__value {
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			text-transform: uppercase;
			color: var(--nimble-medium-text-color);

			&--penalty {
				color: var(--nimble-validation-error-color);
			}
		}
	}

	.nimble-gm-roll-options {
		margin-top: 0.75rem;
		padding-top: 0.625rem;
		border-top: 1px dashed var(--nimble-card-border-color);

		&__option {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			cursor: pointer;
		}

		&__icon {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__label {
			flex: 1;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}
	}
</style>
