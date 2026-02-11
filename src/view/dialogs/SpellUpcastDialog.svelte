<script lang="ts">
	import type { ScalingDelta } from '#types/spellScaling.js';
	import { NimbleRoll } from '../../dice/NimbleRoll';
	import RollModeConfig from './components/RollModeConfig.svelte';
	import RangeSlider from 'svelte-range-slider-pips';

	let { actor, dialog, spell, ...data } = $props();

	// Initialize state
	let selectedRollMode = $state(Math.clamp(data.rollMode ?? 0, -6, 6));
	let situationalModifiers = $state('');
	let primaryDieValue = $state();
	let primaryDieModifier = $state();

	// I18n helpers
	const { hitDice, spellUpcastDialog, effectTypes, spellProperties, itemConfig, objectTypes } =
		CONFIG.NIMBLE;
	const format = (key: string, data?: Record<string, string>) => game.i18n.format(key, data);

	// Compute upcast constraints
	const baseMana = spell.tier;
	const currentMana = actor.system.resources.mana.current;
	const maxTier = actor.system.resources.highestUnlockedSpellTier;
	const maxMana = Math.min(currentMana, maxTier);

	// Check if spell can be upcast
	const canUpcast = spell.tier > 0 && spell.scaling && spell.scaling.mode !== 'none';
	const hasChoices = spell.scaling?.mode === 'upcastChoice';
	const isHealingSpell = spell.activation?.effects?.some(
		(e: { type: string }) => e.type === 'healing',
	);

	// Upcast state
	let manaToSpend = $state(baseMana);
	let choiceIndex = $state(0);

	// Derived values
	let upcastSteps = $derived(manaToSpend - baseMana);
	// let remainingMana = $derived(currentMana - manaToSpend);

	// Compute preview of upcast effects
	const damageOrHealingOps = new Set(['addFlatDamage', 'addDice']);

	let upcastPreview = $derived(() => {
		if (!canUpcast || upcastSteps === 0) return [];

		const deltas: ScalingDelta[] = hasChoices
			? spell.scaling.choices[choiceIndex]?.deltas || []
			: spell.scaling.deltas;

		const preview = deltas.map((delta: ScalingDelta) => {
			const amount = getScaledAmount(delta, upcastSteps);
			return formatDeltaPreview(delta, amount, spell.school);
		});

		// If the chosen enhancement doesn't modify damage/healing, show the base effect
		const modifiesDamageOrHealing = deltas.some((d: ScalingDelta) =>
			damageOrHealingOps.has(d.operation),
		);
		if (!modifiesDamageOrHealing) {
			const baseEffect = spell.activation?.effects?.find(
				(e: { type: string; formula?: string }) =>
					(e.type === 'damage' || e.type === 'healing') && e.formula,
			);
			if (baseEffect) {
				const label =
					baseEffect.type === 'healing'
						? effectTypes.healing
						: `${spell.school} ${effectTypes.damage}`;
				const calculatedFormula = new NimbleRoll(baseEffect.formula, actor.getRollData());
				preview.push(`${calculatedFormula.formula} ${label}`);
			}
		}

		return preview;
	});

	function getScaledAmount(delta: ScalingDelta, steps: number) {
		if (delta.operation === 'addDice' && delta.dice) {
			return `${delta.dice.count * steps}d${delta.dice.faces}`;
		}
		if (delta.value !== null && delta.value !== undefined) {
			return delta.value * steps;
		}
		return delta.condition || '';
	}

	function formatDeltaPreview(
		delta: ScalingDelta,
		amount: ReturnType<typeof getScaledAmount>,
		school: string,
	) {
		const effectLabel = isHealingSpell ? effectTypes.healing : `${school} ${effectTypes.damage}`;
		const operations = {
			addFlatDamage: `+${amount} ${effectLabel}`,
			addDice: `+${amount} ${effectLabel}`,
			addReach: `+${amount} ${spellProperties.reach}`,
			addRange: `+${amount} ${spellProperties.range}`,
			addTargets: `+${amount} ${Number(amount) > 1 ? itemConfig.targets : itemConfig.target}`,
			addAreaSize: `+${amount} ${itemConfig.areaSize}`,
			addDC: `+${amount} DC`,
			addDuration: `+${amount} ${itemConfig.duration}`,
			addCondition: `+${amount} ${effectTypes.condition}`,
			addArmor: `+${amount} ${objectTypes.armor}`,
		};
		return operations[delta.operation] || delta.operation;
	}
</script>

<article class="nimble-sheet__body" style="--nimble-sheet-body-padding-block-start: 0.5rem">
	<RollModeConfig bind:selectedRollMode />

	{#if canUpcast}
		<hr />
		<div class="nimble-upcast-section">
			<h3 class="nimble-upcast-heading">
				{format(spellUpcastDialog.upcastHeading, {
					spellName: spell.parent.name,
				})}
			</h3>
			<div class="nimble-mana-slider">
				<div class="nimble-upcast-meta">
					<span class="nimble-upcast-steps"
						>{format(spellUpcastDialog.slider.level)}: <strong>{upcastSteps}</strong></span
					>
				</div>
				<section class="nimble-spell-roll-mode-config">
					<RangeSlider
						pips
						float
						all="label"
						min={baseMana}
						max={maxMana}
						formatter={(value) => `${value} Mana`}
						--range-float-text="var(--nimble-light-text-color)"
						--range-handle="var(--nimble-range-slider-handle-color)"
						--range-handle-focus="var(--nimble-range-slider-handle-color)"
						--range-handle-inactive="var(--nimble-range-slider-handle-color)"
						--range-pip="var(--nimble-dark-text-color)"
						--range-pip-active="var(--nimble-dark-text-color)"
						--range-pip-hover="var(--nimble-dark-text-color)"
						--range-slider="var(--nimble-accent-color)"
						spring={false}
						bind:value={manaToSpend}
					/>
				</section>
			</div>
			<div class="nimble-upcast-info">
				{#if hasChoices && spell.scaling.choices && upcastSteps > 0}
					<fieldset class="nimble-upcast-choices">
						<legend class="nimble-choices-label"
							>{format(spellUpcastDialog.chooseEnhancement)}</legend
						>
						{#each spell.scaling.choices as choice, i}
							<label class="nimble-choice-option">
								<input type="radio" name="upcast-choice" value={i} bind:group={choiceIndex} />
								<span>{choice.label}</span>
							</label>
						{/each}
					</fieldset>
				{/if}

				{#if upcastSteps > 0 && upcastPreview().length > 0}
					<div class="nimble-upcast-preview">
						<h4 class="nimble-preview-heading">{format(spellUpcastDialog.appliedEffect)}</h4>
						<ul class="nimble-preview-list">
							{#each upcastPreview() as effect}
								<li>{effect}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="nimble-roll-modifiers-container">
		<div class="nimble-roll-modifiers">
			<label>
				{format(hitDice.situationalModifiers)}:
				<input type="string" bind:value={situationalModifiers} placeholder="0" />
			</label>
		</div>
	</div>

	<div class="nimble-roll-modifiers-container">
		<div class="nimble-roll-modifiers">
			<label>
				{format(hitDice.setPrimaryDie)}:
				<input type="number" bind:value={primaryDieValue} placeholder="0" />
			</label>
		</div>

		<div class="nimble-roll-modifiers">
			<label>
				{format(hitDice.setPrimaryDieModifier)}:
				<input
					type="number"
					bind:value={primaryDieModifier}
					placeholder="0"
					disabled={primaryDieValue !== undefined ? false : true}
				/>
			</label>
		</div>
	</div>
</article>

<footer class="nimble-sheet__footer">
	<button
		class="nimble-button"
		data-button-variant="basic"
		onclick={() => {
			console.log('[SpellUpcastDialog] Cast button clicked');

			// Validate situational modifiers
			if (situationalModifiers !== '') {
				const isValid = Roll.validate(situationalModifiers);
				if (!isValid) {
					ui.notifications?.warn('Invalid dice formula in situational modifiers.');
					return;
				}
			}

			// Validate mana (only for tiered spells that cost mana)
			if (baseMana > 0) {
				if (manaToSpend < baseMana) {
					ui.notifications?.warn(
						`Must spend at least ${baseMana} mana for a tier ${baseMana} spell.`,
					);
					return;
				}
				if (manaToSpend > currentMana) {
					ui.notifications?.warn(
						`Not enough mana. You have ${currentMana}, but need ${manaToSpend}.`,
					);
					return;
				}
			}

			if (manaToSpend > maxTier) {
				ui.notifications?.warn(
					`Cannot spend more mana than your highest unlocked spell tier (${maxTier}).`,
				);
				return;
			}

			const activationData = {
				rollMode: selectedRollMode,
				situationalModifiers,
				primaryDieValue,
				primaryDieModifier,
				upcast: canUpcast
					? {
							manaToSpend,
							choiceIndex: hasChoices ? choiceIndex : undefined,
						}
					: undefined,
			};
			dialog.submitActivation(activationData);
		}}
	>
		<i class="nimble-button__icon fa-solid fa-wand-magic-sparkles"></i>
		{format(spellUpcastDialog.castSpell)}
	</button>
</footer>

<style lang="scss">
	[data-button-variant='basic'] {
		--nimble-button-padding: 0.5rem;
		--nimble-button-width: 100%;
	}

	.nimble-upcast-info {
		display: flex;
		flex-direction: column;
		gap: 1rem;

		.nimble-upcast-choices {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;

			.nimble-choice-option {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				padding: 0.5rem;
				background: var(--nimble-background-color-tertiary);
				border-radius: var(--nimble-border-radius);
				cursor: pointer;
				transition: background 0.15s ease;

				&:hover {
					background: var(--nimble-background-color-hover);
				}

				input[type='radio'] {
					border: none;
					background: var(--nimble-background-color-secondary);
					cursor: pointer;
				}

				span {
					flex: 1;
					font-size: 0.875rem;
				}
			}
		}

		.nimble-upcast-preview {
			margin: 0 auto;
			background: var(--nimble-background-color-tertiary);
			border-radius: var(--nimble-border-radius);
			border: 1px solid var(--nimble-color-primary-alpha);

			.nimble-preview-heading {
				margin: 0 0 0.5rem 0;
				font-size: 1rem;
				font-weight: 600;
				color: var(--nimble-color-primary);
			}

			.nimble-preview-list {
				margin: 0;
				padding-left: 0;
				list-style: none;

				li {
					font-size: 0.875rem;
					color: var(--nimble-text-color-primary);
					margin-bottom: 0.25rem;

					&:last-child {
						margin-bottom: 0;
					}
				}
			}
		}
	}

	.nimble-upcast-section {
		padding: 1rem;
		background: var(--nimble-background-color-secondary);
		border-radius: var(--nimble-border-radius);
	}

	.nimble-upcast-heading {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--nimble-color-primary);
	}

	.nimble-mana-slider {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.nimble-upcast-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
		color: var(--nimble-text-color-secondary);

		strong {
			color: var(--nimble-text-color-primary);
		}
	}

	.nimble-choices-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--nimble-text-color-primary);
		margin-bottom: 0.25rem;
	}

	.nimble-roll-modifiers-container {
		display: flex;
		gap: 1rem;
		margin-top: 1rem;
	}

	.nimble-roll-modifiers {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;

		label {
			display: flex;
			align-items: center;
			gap: 0.5rem;

			input {
				padding: 0.5rem;
				border: 1px solid var(--nimble-border-color);
				border-radius: var(--nimble-border-radius);
				flex: 1;
			}
		}
	}
</style>
