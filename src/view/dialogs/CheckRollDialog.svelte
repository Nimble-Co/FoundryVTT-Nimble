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

	// Unselected rows preview what the option offers; a selected row reports what it
	// actually contributed, which the slider's ends can clamp to nothing.
	function appliedValue(option: SituationalRollModeOption): number {
		return appliedAdjustments[option.key] ?? option.value;
	}

	function situationalLabel(option: SituationalRollModeOption): string {
		const value = appliedValue(option);

		if (value === 0) {
			return localize('NIMBLE.checkRollDialog.situationalRollMode.noEffect');
		}

		if (value > 0) {
			return localize('NIMBLE.checkRollDialog.situationalRollMode.advantage', { count: value });
		}

		return localize('NIMBLE.checkRollDialog.situationalRollMode.disadvantage', {
			count: Math.abs(value),
		});
	}

	function optionDirection(option: SituationalRollModeOption): 'bonus' | 'penalty' | 'none' {
		const value = appliedValue(option);

		if (value === 0) return 'none';
		return value < 0 ? 'penalty' : 'bonus';
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
							data-direction={optionDirection(option)}
						>
							<input
								type="checkbox"
								checked={isSelected(option)}
								onchange={(event) => toggleSituational(option, event.currentTarget.checked)}
							/>
							{#if option.icon}
								<img class="nimble-situational__icon" src={option.icon} alt="" />
							{:else}
								<span class="nimble-situational__icon" aria-hidden="true"></span>
							{/if}
							<span class="nimble-situational__label">{option.label}</span>
							<span class="nimble-situational__value">{situationalLabel(option)}</span>
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
				<input type="checkbox" bind:checked={shouldRollBeHidden} />
				<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>
				<span>{skillCheckDialog.hideRoll}</span>
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
		// Advantage and disadvantage borrow the roll success/failure pair: it is the
		// system's only semantic green/red defined for both themes. The accent colour
		// is desaturated in dark mode and reads as disabled at these sizes.
		--nimble-situational-accent: var(--nimble-roll-success-color);
		--nimble-situational-accent-background: var(--nimble-roll-success-background-color);

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
			grid-template-columns: auto 1.75rem 1fr auto;
			align-items: center;
			gap: 0.625rem;
			padding: 0.375rem 0.5rem;
			border: 1px solid transparent;
			border-radius: 4px;
			cursor: pointer;
			transition: var(--nimble-standard-transition);

			&[data-direction='penalty'] {
				--nimble-situational-accent: var(--nimble-roll-failure-color);
				--nimble-situational-accent-background: var(--nimble-roll-failure-background-color);
			}

			&[data-direction='none'] {
				--nimble-situational-accent: var(--nimble-medium-text-color);
				--nimble-situational-accent-background: transparent;
			}

			// currentColor tracks the theme's body text, so the tint stays visible in
			// both themes without a second set of tokens.
			&:hover {
				background: color-mix(in srgb, currentColor 8%, transparent);
			}

			&--selected {
				border-color: color-mix(in srgb, var(--nimble-situational-accent) 45%, transparent);
				background: color-mix(in srgb, var(--nimble-situational-accent) 14%, transparent);
			}
		}

		// Square, unringed and dark-backed, matching the feature cards on the character
		// sheet's Features tab, so the same artwork reads as the same item in both places.
		// Direction is carried by the row tint and the value pill, not by the icon.
		&__icon {
			width: 1.75rem;
			height: 1.75rem;
			border: 0;
			border-radius: 0;
			object-fit: cover;
			object-position: center;

			// The backing is scoped to the image: the `{:else}` element is a bare spacer
			// keeping the grid columns aligned, and must stay invisible.
			&:is(img) {
				background: var(--nimble-artwork-backdrop);
			}

			&[src$='.svg' i] {
				padding: 0.2rem;
			}
		}

		&__label {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			line-height: 1.2;
		}

		&__value {
			padding: 0.125rem 0.5rem;
			border-radius: 999px;
			background: var(--nimble-situational-accent-background);
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			white-space: nowrap;
			color: var(--nimble-situational-accent);
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
		font-size: var(--nimble-xs-text);
		font-weight: 600;
		color: var(--nimble-medium-text-color);
	}
</style>
