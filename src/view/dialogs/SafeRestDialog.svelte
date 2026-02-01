<script lang="ts">
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';
	import { incrementDieSize } from '../../managers/HitDiceManager.js';
	import { getManaRecoveryTypesFromClasses, restoresManaOnRest } from '../../utils/manaRecovery.js';

	interface Props {
		document: NimbleCharacter;
		dialog: GenericDialog;
	}

	function submit() {
		dialog.submit({
			skipChatCard: false,
		});
	}

	let { document: actor, dialog }: Props = $props();

	// Use reactive data so values update when the character sheet changes
	let hp = $derived(actor.reactive.system.attributes.hp);
	let hpRecovery = $derived(hp.max - hp.value);
	let tempHpLoss = $derived(hp.temp);

	let mana = $derived(actor.reactive.system.resources.mana);
	let manaRecoveryTypes = $derived.by(() =>
		getManaRecoveryTypesFromClasses(actor.reactive.items.filter((i) => i.type === 'class')),
	);
	let restoresManaOnSafeRest = $derived.by(() => restoresManaOnRest(manaRecoveryTypes, 'safe'));
	let manaRecovery = $derived(restoresManaOnSafeRest ? mana.max - mana.current : 0);

	let wounds = $derived(actor.reactive.system.attributes.wounds);
	let woundRecovery = $derived(Math.min(wounds.value, 1));

	// Reactive hit dice computation (mirrors PlayerCharacterSheet pattern)
	let hitDice = $derived.by(() => {
		const hitDiceAttr = actor.reactive.system.attributes.hitDice;
		const bonusHitDice = actor.reactive.system.attributes.bonusHitDice ?? [];
		const classes = actor.reactive.items.filter((i) => i.type === 'class');
		const hitDiceSizeBonus = actor.reactive.system.attributes.hitDiceSizeBonus ?? 0;

		const bySize: Record<number, { current: number; total: number }> = {};

		// Add from classes (apply hitDiceSizeBonus to get effective size)
		for (const cls of classes) {
			const baseSize = cls.system.hitDieSize;
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			bySize[size] ??= { current: 0, total: 0 };
			bySize[size].total += cls.system.classLevel;
			bySize[size].current = hitDiceAttr[size]?.current ?? 0;
		}

		// Get effective class sizes (after applying bonus) for later checks
		const effectiveClassSizes = classes.map((cls) =>
			incrementDieSize(cls.system.hitDieSize, hitDiceSizeBonus),
		);

		// Add from bonusHitDice array (apply hitDiceSizeBonus to increment)
		for (const entry of bonusHitDice) {
			const size = incrementDieSize(entry.size, hitDiceSizeBonus);
			bySize[size] ??= { current: hitDiceAttr[size]?.current ?? 0, total: 0 };
			bySize[size].total += entry.value;
			if (!effectiveClassSizes.includes(size)) {
				bySize[size].current = hitDiceAttr[size]?.current ?? 0;
			}
		}

		// Get effective bonus array sizes (after increment) for later checks
		const effectiveBonusArraySizes = bonusHitDice.map((entry) =>
			incrementDieSize(entry.size, hitDiceSizeBonus),
		);

		// Add from rule-based bonuses (hitDice[size].bonus)
		for (const [sizeStr, hitDieData] of Object.entries(hitDiceAttr ?? {})) {
			const baseSize = Number(sizeStr);
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			const bonus = hitDieData?.bonus ?? 0;
			if (bonus > 0) {
				bySize[size] ??= { current: 0, total: 0 };
				bySize[size].total += bonus;

				const fromClass = effectiveClassSizes.includes(size);
				const fromBonusArray = effectiveBonusArraySizes.includes(size);
				if (!fromClass && !fromBonusArray) {
					bySize[size].current = hitDiceAttr[size]?.current ?? 0;
				}
			}
		}

		return bySize;
	});

	let hitDiceRecovery = $derived(
		Object.entries(hitDice).reduce(
			(acc, [die, { current, total }]) => {
				const consumed = total - current;
				if (consumed > 0) {
					acc[die] = consumed;
				}
				return acc;
			},
			{} as Record<string, number>,
		),
	);
	let totalHitDiceRecovery = $derived(
		Object.values(hitDiceRecovery).reduce((sum, n) => sum + n, 0),
	);

	// Check if there's anything to recover
	let hasAnyRecovery = $derived(
		hpRecovery > 0 ||
			tempHpLoss > 0 ||
			totalHitDiceRecovery > 0 ||
			(restoresManaOnSafeRest && mana.max > 0 && manaRecovery > 0) ||
			woundRecovery > 0,
	);
</script>

<article class="nimble-sheet__body safe-rest-dialog">
	<section class="safe-rest-dialog__section">
		<h3 class="safe-rest-dialog__heading">{CONFIG.NIMBLE.safeRest.recoveryPreview}</h3>

		<div class="recovery-grid">
			<!-- Hit Points -->
			<div class="recovery-card" class:recovery-card--inactive={hpRecovery === 0}>
				<div class="recovery-card__icon-wrapper recovery-card__icon-wrapper--hp">
					<i class="fa-solid fa-heart"></i>
				</div>
				<div class="recovery-card__content">
					<span class="recovery-card__label">{CONFIG.NIMBLE.safeRest.hitPoints}</span>
					<span class="recovery-card__value">
						{#if hpRecovery > 0}
							<span class="recovery-card__change recovery-card__change--positive"
								>+{hpRecovery}</span
							>
							<span class="recovery-card__detail">({hp.value} → {hp.max})</span>
						{:else}
							<span class="recovery-card__full">{CONFIG.NIMBLE.safeRest.alreadyFull}</span>
						{/if}
					</span>
				</div>
			</div>

			<!-- Temp HP Loss -->
			{#if tempHpLoss > 0}
				<div class="recovery-card recovery-card--loss">
					<div class="recovery-card__icon-wrapper recovery-card__icon-wrapper--temp">
						<i class="fa-solid fa-shield-halved"></i>
					</div>
					<div class="recovery-card__content">
						<span class="recovery-card__label">{CONFIG.NIMBLE.safeRest.tempHp}</span>
						<span class="recovery-card__value">
							<span class="recovery-card__change recovery-card__change--negative"
								>-{tempHpLoss}</span
							>
							<span class="recovery-card__detail">{CONFIG.NIMBLE.safeRest.removed}</span>
						</span>
					</div>
				</div>
			{/if}

			<!-- Hit Dice -->
			<div class="recovery-card" class:recovery-card--inactive={totalHitDiceRecovery === 0}>
				<div class="recovery-card__icon-wrapper recovery-card__icon-wrapper--hd">
					<i class="fa-solid fa-dice-d20"></i>
				</div>
				<div class="recovery-card__content">
					<span class="recovery-card__label">{CONFIG.NIMBLE.safeRest.hitDice}</span>
					<span class="recovery-card__value">
						{#if totalHitDiceRecovery > 0}
							{#each Object.entries(hitDiceRecovery) as [die, amount], i}
								{#if i > 0}<span class="recovery-card__separator">,</span>{/if}
								<span class="recovery-card__change recovery-card__change--positive">+{amount}</span>
								<span class="recovery-card__die">d{die}</span>
							{/each}
						{:else}
							<span class="recovery-card__full">{CONFIG.NIMBLE.safeRest.alreadyFull}</span>
						{/if}
					</span>
				</div>
			</div>

			<!-- Mana (only show if character has mana) -->
			{#if mana.max > 0 && restoresManaOnSafeRest}
				<div class="recovery-card" class:recovery-card--inactive={manaRecovery === 0}>
					<div class="recovery-card__icon-wrapper recovery-card__icon-wrapper--mana">
						<i class="fa-solid fa-sparkles"></i>
					</div>
					<div class="recovery-card__content">
						<span class="recovery-card__label">{CONFIG.NIMBLE.safeRest.mana}</span>
						<span class="recovery-card__value">
							{#if manaRecovery > 0}
								<span class="recovery-card__change recovery-card__change--positive"
									>+{manaRecovery}</span
								>
								<span class="recovery-card__detail">({mana.current} → {mana.max})</span>
							{:else}
								<span class="recovery-card__full">{CONFIG.NIMBLE.safeRest.alreadyFull}</span>
							{/if}
						</span>
					</div>
				</div>
			{/if}

			<!-- Wounds -->
			<div class="recovery-card" class:recovery-card--inactive={woundRecovery === 0}>
				<div class="recovery-card__icon-wrapper recovery-card__icon-wrapper--wounds">
					<i class="fa-solid fa-bandage"></i>
				</div>
				<div class="recovery-card__content">
					<span class="recovery-card__label">{CONFIG.NIMBLE.safeRest.wounds}</span>
					<span class="recovery-card__value">
						{#if woundRecovery > 0}
							<span class="recovery-card__change recovery-card__change--positive">-1</span>
							<span class="recovery-card__detail">({wounds.value} → {wounds.value - 1})</span>
						{:else}
							<span class="recovery-card__full">{CONFIG.NIMBLE.safeRest.noWounds}</span>
						{/if}
					</span>
				</div>
			</div>
		</div>
	</section>

	{#if !hasAnyRecovery}
		<div class="safe-rest-dialog__info">
			<i class="fa-solid fa-circle-check"></i>
			<span>{CONFIG.NIMBLE.safeRest.allResourcesFull}</span>
		</div>
	{/if}
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}>
		{CONFIG.NIMBLE.safeRest.safeRestButton}
	</button>
</footer>

<style lang="scss">
	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.safe-rest-dialog {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;

		&__section {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
		}

		&__heading {
			margin: 0;
			padding: 0;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--nimble-medium-text-color);
			border: none;
		}

		&__info {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.75rem 1rem;
			background: hsla(120, 40%, 50%, 0.1);
			border: 1px solid hsla(120, 40%, 50%, 0.3);
			border-radius: 6px;
			font-size: var(--nimble-sm-text);
			color: hsl(120, 35%, 35%);

			i {
				color: hsl(120, 45%, 40%);
			}
		}
	}

	.recovery-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.recovery-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.875rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 6px;
		transition: all 0.15s ease;

		&--inactive {
			opacity: 0.6;
		}

		&--loss {
			background: hsla(0, 50%, 50%, 0.08);
			border-color: hsla(0, 50%, 50%, 0.25);
		}

		&__icon-wrapper {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			border-radius: 6px;
			font-size: 0.875rem;
			flex-shrink: 0;

			&--hp {
				background: hsla(0, 65%, 50%, 0.15);
				color: hsl(0, 65%, 45%);
			}

			&--temp {
				background: hsla(0, 50%, 50%, 0.15);
				color: hsl(0, 50%, 45%);
			}

			&--hd {
				background: hsla(45, 70%, 50%, 0.15);
				color: hsl(45, 70%, 40%);
			}

			&--mana {
				background: hsla(260, 60%, 55%, 0.15);
				color: hsl(260, 60%, 45%);
			}

			&--wounds {
				background: hsla(25, 70%, 50%, 0.15);
				color: hsl(25, 70%, 40%);
			}
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
			min-width: 0;
		}

		&__label {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__value {
			display: flex;
			align-items: center;
			gap: 0.25rem;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}

		&__change {
			font-weight: 700;

			&--positive {
				color: hsl(120, 45%, 40%);
			}

			&--negative {
				color: hsl(0, 55%, 50%);
			}
		}

		&__detail {
			color: var(--nimble-medium-text-color);
		}

		&__die {
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__separator {
			margin-right: 0.25rem;
		}

		&__full {
			font-style: italic;
			color: var(--nimble-medium-text-color);
		}
	}

	// Dark mode overrides
	:global(.theme-dark) {
		.safe-rest-dialog__info {
			background: hsla(120, 40%, 50%, 0.15);
			border-color: hsla(120, 40%, 50%, 0.4);
			color: hsl(120, 40%, 70%);

			i {
				color: hsl(120, 50%, 60%);
			}
		}

		.recovery-card {
			background: hsl(220, 15%, 18%);
			border-color: hsl(220, 10%, 30%);

			&--loss {
				background: hsla(0, 50%, 50%, 0.12);
				border-color: hsla(0, 50%, 50%, 0.35);
			}

			&__icon-wrapper {
				&--hp {
					background: hsla(0, 65%, 50%, 0.2);
					color: hsl(0, 65%, 60%);
				}

				&--temp {
					background: hsla(0, 50%, 50%, 0.2);
					color: hsl(0, 50%, 60%);
				}

				&--hd {
					background: hsla(45, 70%, 50%, 0.2);
					color: hsl(45, 70%, 60%);
				}

				&--mana {
					background: hsla(260, 60%, 55%, 0.2);
					color: hsl(260, 60%, 70%);
				}

				&--wounds {
					background: hsla(25, 70%, 50%, 0.2);
					color: hsl(25, 70%, 60%);
				}
			}

			&__change {
				&--positive {
					color: hsl(120, 50%, 60%);
				}

				&--negative {
					color: hsl(0, 60%, 65%);
				}
			}
		}
	}
</style>
