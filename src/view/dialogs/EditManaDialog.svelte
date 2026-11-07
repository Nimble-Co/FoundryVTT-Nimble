<script lang="ts">
	import { untrack } from 'svelte';
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';
	import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
	import {
		getManaRecoveryTypesFromClasses,
		type ManaRecoveryType,
	} from '../../utils/actor/manaRecovery.js';

	interface Props {
		document: NimbleCharacter;
		dialog: GenericDialog;
	}

	interface ClassManaContribution {
		name: string;
		formula: string;
		value: number;
	}

	interface ClassWithManaFormula {
		name: string;
		system: {
			mana: {
				formula: string;
			};
		};
	}

	const recoveryDisplayOrder: ManaRecoveryType[] = ['safeRest', 'fieldRest', 'initiative'];

	function localizeRecoveryType(type: ManaRecoveryType) {
		return game.i18n.localize(CONFIG.NIMBLE.manaRecoveryTypes[type]);
	}

	function submit() {
		dialog.submit({ baseMax: normalizedBaseMax });
	}

	let { document: actor, dialog }: Props = $props();
	let baseMax = $state(untrack(() => actor.system.resources.mana.baseMax ?? 0));

	let classManaContributions = $derived.by(() => {
		const classes = actor.items.filter((i: Item) => i.type === 'class') as ClassWithManaFormula[];
		const includeClassFormula = actor.levels.character > 1;
		const rollData = actor.getRollData();

		return classes.reduce((acc, cls) => {
			const formula = cls.system.mana.formula?.trim();
			if (!formula) return acc;

			const value = includeClassFormula ? (getDeterministicBonus(formula, rollData) ?? 0) : 0;
			acc.push({
				name: cls.name,
				formula,
				value,
			});
			return acc;
		}, [] as ClassManaContribution[]);
	});

	let normalizedBaseMax = $derived(Math.max(0, Number(baseMax) || 0));
	let classContributionTotal = $derived(
		classManaContributions.reduce((sum, entry) => sum + entry.value, 0),
	);
	let totalMaxMana = $derived(normalizedBaseMax + classContributionTotal);

	let effectiveRecoveryTypes = $derived.by(() => {
		const classes = actor.items.filter((i: Item) => i.type === 'class');
		const types = getManaRecoveryTypesFromClasses(classes);
		if (types.size === 0) {
			types.add('safeRest');
		}

		return recoveryDisplayOrder.filter((type) => types.has(type));
	});

	let hasInitiativeRecovery = $derived(effectiveRecoveryTypes.includes('initiative'));
</script>

<article class="nimble-sheet__body nimble-edit-mana-dialog">
	<section class="mana-section">
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				<i class="fa-solid fa-wand-sparkles"></i>
				{CONFIG.NIMBLE.manaConfig.classContributions}
			</h3>
			<span class="mana-subtitle">{CONFIG.NIMBLE.manaConfig.classContributionsHint}</span>
		</header>

		{#if classManaContributions.length === 0}
			<p class="mana-empty">{CONFIG.NIMBLE.manaConfig.noClassContributions}</p>
		{:else}
			<div class="mana-contribution-list">
				{#each classManaContributions as entry}
					<div class="mana-contribution-card">
						<div class="mana-contribution-card__header">
							<span class="mana-contribution-card__name">{entry.name}</span>
							<span class="mana-contribution-card__value">+{entry.value}</span>
						</div>
						<span class="mana-contribution-card__formula">
							{CONFIG.NIMBLE.manaConfig.formulaLabel}: {entry.formula}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section class="mana-section">
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				<i class="fa-solid fa-sliders"></i>
				{CONFIG.NIMBLE.manaConfig.baseMana}
			</h3>
			<span class="mana-subtitle">{CONFIG.NIMBLE.manaConfig.baseManaHint}</span>
		</header>

		<div class="mana-base-row">
			<label class="mana-base-row__label" for="base-mana">
				{CONFIG.NIMBLE.manaConfig.baseMana}
			</label>
			<input
				id="base-mana"
				class="mana-base-row__input"
				data-look="plain"
				type="number"
				min="0"
				step="1"
				bind:value={baseMax}
			/>
		</div>
	</section>

	<section class="mana-section">
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				<i class="fa-solid fa-hourglass-half"></i>
				{CONFIG.NIMBLE.manaConfig.recoveryProfile}
			</h3>
		</header>

		<div class="mana-recovery-types">
			{#each effectiveRecoveryTypes as recoveryType}
				<span class="mana-recovery-pill">
					{localizeRecoveryType(recoveryType)}
				</span>
			{/each}
		</div>

		{#if hasInitiativeRecovery}
			<p class="mana-note">{CONFIG.NIMBLE.manaConfig.initiativeInfo}</p>
		{/if}
	</section>

	<section class="mana-total">
		<span class="mana-total__label">{CONFIG.NIMBLE.manaConfig.totalMaxMana}</span>
		<span class="mana-total__value">{totalMaxMana}</span>
	</section>
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}
		>{CONFIG.NIMBLE.manaConfig.saveChanges}</button
	>
</footer>

<style lang="scss">
	:global(.nimble-window) .nimble-sheet__body.nimble-edit-mana-dialog {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 12px;
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.mana-section .nimble-section-header {
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;

		i {
			display: none;
		}
	}

	:global(.nimble-window)
		.nimble-edit-mana-dialog
		> .mana-section:first-child
		> .nimble-section-header {
		margin-top: 0;
	}

	.mana-subtitle {
		display: block;
		font-size: 0.75rem;
		line-height: 1.3;
		color: var(--nimble-ui-ink-muted);
	}

	.mana-empty {
		margin: 0;
		padding: 4px;
		font-size: 0.75rem;
		color: var(--nimble-ui-ink-muted);
	}

	.mana-contribution-list {
		display: flex;
		flex-direction: column;
	}

	.mana-contribution-card {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1px;
		min-height: 34px;
		padding: 4px;

		&__header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 14px;
		}

		&__name {
			font-size: 0.813rem;
			color: var(--nimble-ui-ink);
		}

		&__value {
			font-size: 0.875rem;
			font-weight: 700;
			color: var(--nimble-ui-action);
		}

		&__formula {
			font-family: var(--nimble-mono-font);
			font-size: 0.75rem;
			line-height: 1.3;
			color: var(--nimble-ui-ink-muted);
		}
	}

	.mana-base-row {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 34px;
		padding: 4px;

		&__label {
			flex: 1;
			min-width: 0;
			font-size: 0.813rem;
			color: var(--nimble-ui-ink);
		}

		input.mana-base-row__input[data-look='plain'] {
			box-sizing: border-box;
			flex: none;
			width: 64px;
			height: 26px;
			padding: 0 3px;
			border: 0;
			border-bottom: 1px dashed var(--nimble-ui-ring);
			border-radius: 0;
			background: none;
			box-shadow: none;
			font-size: 0.875rem;
			font-weight: 700;
			text-align: right;
			color: var(--nimble-ui-ink);
			appearance: textfield;

			&::-webkit-inner-spin-button,
			&::-webkit-outer-spin-button {
				appearance: none;
			}

			&:focus {
				border-bottom: 1px solid var(--nimble-ui-highlight);
				outline: none;
			}
		}
	}

	.mana-recovery-types {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 4px;
	}

	.mana-recovery-pill {
		padding: 0 5px;
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px var(--nimble-ui-ring);
		font-size: 0.656rem;
		font-weight: 800;
		line-height: 16px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--nimble-ui-ink-muted);
	}

	.mana-note {
		margin: 0;
		padding: 0 4px 4px;
		font-size: 0.75rem;
		line-height: 1.3;
		color: var(--nimble-ui-ink-muted);
	}

	.mana-total {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 8px;
		padding: 6px 4px 0;
		border-top: 1px solid var(--nimble-ui-soft);

		&__label {
			font-size: 0.75rem;
			font-weight: 900;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--nimble-ui-ink-dim);
		}

		&__value {
			font-size: 1.15rem;
			font-weight: 900;
			color: var(--nimble-ui-ink);
		}
	}
</style>
