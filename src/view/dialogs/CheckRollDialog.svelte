<script lang="ts">
	import type { CheckRollDialogProps } from '#types/components/CheckRollDialog.d.ts';

	import { untrack } from 'svelte';

	import { SYSTEM_ID } from '#system';
	import localize from '#utils/localize.ts';
	import getRollFormula from '../../utils/getRollFormula.js';
	import RollModeConfig from './components/RollModeConfig.svelte';
	import formatRollModeLabel from './formatRollModeLabel.js';
	import { collectSituationalRules } from './situationalSaveRules.js';

	const { skillCheckDialog, saveConfig } = CONFIG.NIMBLE;

	let { actor, dialog, type = 'abilityCheck', ...data }: CheckRollDialogProps = $props();
	let selectedRollMode = $state(untrack(() => Math.clamp(Number(data.rollMode ?? 0), -6, 6)));
	let shouldRollBeHidden = $state(Boolean(game.settings.get(SYSTEM_ID, 'hideRolls')));

	// Situational rules name a circumstance ("advantage against poison saves") the system can't
	// know applies, so they never move the stored default. The player opts each one in per roll.
	let situationalRules = $derived(
		type === 'savingThrow' ? collectSituationalRules(actor.items ?? []) : [],
	);
	let appliedSituations = $state(new Set<number>());

	let situationalRollMode = $derived(
		situationalRules.reduce(
			(total, rule, index) => (appliedSituations.has(index) ? total + rule.value : total),
			0,
		),
	);

	// The slider stays the player's own baseline; the toggles bump it for this roll only.
	let effectiveRollMode = $derived(Math.clamp(selectedRollMode + situationalRollMode, -6, 6));

	function toggleSituation(index: number) {
		const next = new Set(appliedSituations);
		if (!next.delete(index)) next.add(index);
		appliedSituations = next;
	}

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
</script>

<article class="nimble-sheet__body" style="--nimble-sheet-body-padding-block-start: 0.5rem">
	<RollModeConfig bind:selectedRollMode />
	{#if situationalRules.length > 0}
		<div class="nimble-roll-modifiers-container">
			<h3 class="nimble-situational__heading">{saveConfig.situational}</h3>
			{#each situationalRules as rule, index}
				<label class="nimble-situational__option">
					<input
						type="checkbox"
						class="modifier-item__checkbox"
						checked={appliedSituations.has(index)}
						onchange={() => toggleSituation(index)}
					/>
					<span class="nimble-situational__label">
						{localize('NIMBLE.saveConfig.situationalToggle', {
							label: rule.label,
							situation: rule.situation,
						})}
					</span>
					<span class="nimble-situational__effect">{formatRollModeLabel(rule.value)}</span>
				</label>
			{/each}
		</div>
	{/if}
	{#if game.user?.isGM}
		<div class="nimble-roll-modifiers-container">
			<label>
				{skillCheckDialog.hideRoll}
				<input type="checkbox" bind:checked={shouldRollBeHidden} class="modifier-item__checkbox" />
			</label>
		</div>
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

	.nimble-situational {
		&__heading {
			margin: 0 0 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-medium-text-color);
			border: 0;
		}

		&__option {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		&__label {
			flex: 1;
		}

		&__effect {
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			color: var(--nimble-medium-text-color);
		}
	}
</style>
