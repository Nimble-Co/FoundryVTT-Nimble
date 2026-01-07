<script lang="ts">
	import type { NimbleCharacter } from '../../documents/actor/character.js';
	import type GenericDialog from '../../documents/dialogs/GenericDialog.svelte.js';

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

	const hp = actor.system.attributes.hp;
	const hpRecovery = hp.max - hp.value;
	const tempHpLoss = hp.temp;

	const mana = actor.system.resources.mana;
	const manaRecovery = mana.max - mana.current;

	const wounds = actor.system.attributes.wounds;
	const woundRecovery = Math.min(wounds.value, 1);

	const hitDice = actor.HitDiceManager.bySize;
	const hitDiceRecovery = Object.entries(hitDice).reduce(
		(acc, [die, { current, total }]) => {
			const consumed = total - current;
			if (consumed > 0) {
				acc[die] = consumed;
			}
			return acc;
		},
		{} as Record<string, number>,
	);
	const totalHitDiceRecovery = Object.values(hitDiceRecovery).reduce((sum, n) => sum + n, 0);
</script>

<article class="nimble-sheet__body">
	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">Recovery Preview</h3>
		</header>

		<ul class="nimble-safe-rest-preview">
			<li class="nimble-safe-rest-preview__item">
				<span class="nimble-safe-rest-preview__label">Hit Points</span>
				<span class="nimble-safe-rest-preview__value">
					{#if hpRecovery > 0}
						+{hpRecovery} HP ({hp.value} → {hp.max})
					{:else}
						Already full
					{/if}
				</span>
			</li>

			{#if tempHpLoss > 0}
				<li class="nimble-safe-rest-preview__item nimble-safe-rest-preview__item--loss">
					<span class="nimble-safe-rest-preview__label">Temp HP</span>
					<span class="nimble-safe-rest-preview__value">-{tempHpLoss} removed</span>
				</li>
			{/if}

			<li class="nimble-safe-rest-preview__item">
				<span class="nimble-safe-rest-preview__label">Hit Dice</span>
				<span class="nimble-safe-rest-preview__value">
					{#if totalHitDiceRecovery > 0}
						{#each Object.entries(hitDiceRecovery) as [die, amount], i}
							{#if i > 0},
							{/if}
							+{amount} d{die}
						{/each}
					{:else}
						Already full
					{/if}
				</span>
			</li>

			<li class="nimble-safe-rest-preview__item">
				<span class="nimble-safe-rest-preview__label">Mana</span>
				<span class="nimble-safe-rest-preview__value">
					{#if manaRecovery > 0}
						+{manaRecovery} ({mana.current} → {mana.max})
					{:else}
						Already full
					{/if}
				</span>
			</li>

			<li class="nimble-safe-rest-preview__item">
				<span class="nimble-safe-rest-preview__label">Wounds</span>
				<span class="nimble-safe-rest-preview__value">
					{#if woundRecovery > 0}
						-1 wound ({wounds.value} → {wounds.value - 1})
					{:else}
						No wounds
					{/if}
				</span>
			</li>
		</ul>
	</section>
</article>

<footer class="nimble-sheet__footer">
	<button class="nimble-button" data-button-variant="basic" onclick={submit}> Safe Rest </button>
</footer>

<style lang="scss">
	.nimble-sheet__body {
		--nimble-sheet-body-padding-block-start: 0.5rem;
	}

	.nimble-sheet__footer {
		--nimble-button-padding: 0.5rem 1rem;
		--nimble-button-width: 100%;
	}

	.nimble-safe-rest-preview {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;

		&__item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.5rem 0.75rem;
			background: var(--nimble-card-background);
			border-radius: 4px;
			box-shadow: var(--nimble-card-box-shadow);

			&--loss {
				color: var(--nimble-danger-color, hsl(0, 60%, 50%));
			}
		}

		&__label {
			font-weight: 600;
		}

		&__value {
			color: var(--nimble-medium-text-color);
		}
	}
</style>
