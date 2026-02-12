<script lang="ts">
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';
	import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
	import {
		getManaRecoveryTypesFromClasses,
		type ManaRecoveryType,
	} from '../../utils/manaRecovery.js';

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
	let baseMax = $state(actor.system.resources.mana.baseMax ?? 0);

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
	.nimble-edit-mana-dialog {
		--nimble-sheet-body-padding-block-start: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.mana-section {
		padding: 0.625rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;
	}

	.mana-subtitle {
		display: block;
		font-size: var(--nimble-xs-text);
		color: var(--nimble-medium-text-color);
		margin-top: 0.125rem;
		padding-left: 1.125rem;
	}

	.mana-empty {
		margin: 0;
		font-size: var(--nimble-sm-text);
		color: var(--nimble-medium-text-color);
		font-style: italic;
	}

	.mana-contribution-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.mana-contribution-card {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.5rem 0.625rem;
		background: var(--nimble-input-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;

		&__header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 0.5rem;
		}

		&__name {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__value {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			color: hsl(212deg 52% 42%);
		}

		&__formula {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
		}
	}

	.mana-base-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;

		&__label {
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__input {
			width: 5rem;
			padding: 0.375rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			text-align: center;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			background: var(--nimble-input-background-color);
			color: var(--nimble-dark-text-color);

			&:focus {
				outline: 2px solid hsl(212deg 60% 48%);
				outline-offset: -1px;
				border-color: hsl(212deg 60% 48%);
			}
		}
	}

	.mana-recovery-types {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.mana-recovery-pill {
		padding: 0.25rem 0.5rem;
		font-size: var(--nimble-xs-text);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: hsl(212deg 55% 26%);
		background: hsl(212deg 52% 88%);
		border: 1px solid hsl(212deg 52% 74%);
		border-radius: 4px;
	}

	.mana-note {
		margin: 0.5rem 0 0;
		font-size: var(--nimble-xs-text);
		color: var(--nimble-medium-text-color);
		font-style: italic;
	}

	.mana-total {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		background: linear-gradient(to right, hsl(212deg 48% 37%), hsl(212deg 52% 47%));
		border-radius: 6px;

		&__label {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: hsl(212deg 36% 95%);
			text-transform: uppercase;
			letter-spacing: 0.03em;
		}

		&__value {
			font-size: var(--nimble-xl-text);
			font-weight: 700;
			color: #fff;
			text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
		}
	}
</style>
