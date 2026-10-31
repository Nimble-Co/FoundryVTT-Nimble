<script lang="ts">
	import type { CheckRollDialogProps } from '#types/components/CheckRollDialog.d.ts';

	import { untrack } from 'svelte';

	import { SYSTEM_ID } from '#system';
	import Hint from '#view/components/Hint.svelte';
	import getRollFormula from '../../utils/rolls/getRollFormula.js';
	import localize from '../../utils/localize.js';
	import {
		getSituationalRollModeOptions,
		type SituationalRollModeOption,
	} from './CheckRollDialog.utils.js';
	import RollModeField from './components/RollModeField.svelte';
	import RollWindow from './components/RollWindow.svelte';

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

	// The window title starts with the name of the actor; the portrait in the head shows who it is.
	const heading = $derived(dialog.title.replace(`${actor.name}: `, ''));

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

<RollWindow
	title={heading}
	img={actor.img ?? undefined}
	rollLabel={localize('NIMBLE.rollWindow.roll')}
	oncancel={() => dialog.close()}
	onroll={() =>
		dialog.submitRoll({
			rollMode: selectedRollMode,
			rollFormula,
			visibilityMode: shouldRollBeHidden ? 'blindroll' : 'publicroll',
		})}
>
	{#if data.checkHint}
		<Hint hintType="warning" hintIcon="fa-solid fa-circle-exclamation" hintText={data.checkHint} />
	{/if}

	<RollModeField bind:value={selectedRollMode} />

	{#if situationalOptions.length}
		<section class="nimble-situational">
			<h5 class="lb">
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

	<div class="frm">{rollFormula}</div>

	{#if game.user?.isGM}
		<label class="check">
			<input type="checkbox" bind:checked={shouldRollBeHidden} />
			<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>
			<span>{skillCheckDialog.hideRoll}</span>
		</label>
	{/if}
</RollWindow>

<style lang="scss">
	.nimble-situational {
		&__list {
			display: flex;
			flex-direction: column;
			gap: 4px;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__option {
			display: flex;
			align-items: center;
			gap: 8px;
			min-height: 30px;
			padding: 3px 8px;
			border: 1px solid var(--nimble-ui-ring);
			border-radius: 4px;
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--nimble-ui-ink);
			cursor: pointer;

			&:hover {
				border-color: var(--nimble-ui-highlight);
			}

			&:focus-within {
				outline: 2px solid var(--nimble-ui-focus);
				outline-offset: 1px;
			}

			input {
				flex: none;
				margin: 0;
			}

			&--selected {
				border-color: var(--nimble-ui-highlight);
				background: var(--nimble-ui-soft);
			}
		}

		&__icon {
			flex: none;
			width: 22px;
			height: 22px;
			border: 0;
			border-radius: 3px;
		}

		&__label {
			flex: 1;
			min-width: 0;
		}

		&__value {
			flex: none;
			font-weight: 700;
			color: var(--nimble-ui-ink-muted);
		}

		&__option[data-direction='bonus'] &__value {
			color: var(--nimble-ui-action);
		}

		&__option[data-direction='penalty'] &__value {
			color: var(--nimble-ui-warn);
		}
	}
</style>
