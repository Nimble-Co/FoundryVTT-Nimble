<script lang="ts">
	import type { NimbleCharacter } from '#documents/actor/character.js';
	import localize from '#utils/localize.js';
	import { getContext } from 'svelte';

	let actor = getContext<NimbleCharacter>('actor');

	let currency = $derived(actor.reactive?.system?.currency);
</script>

{#each Object.entries(currency).reverse() as [key, denomination] (key)}
	<label class="nimble-currency-wrapper">
		<h4 class="nimble-heading" data-heading-variant="section">
			{#if denomination.label}
				{localize(denomination.label)}
			{:else}
				{localize(`NIMBLE.currencyAbbreviations.${key}`)}
			{/if}

			{#if !denomination.label || denomination.label === `NIMBLE.currencyAbbreviations.${key}`}
				<div class="nimble-coin nimble-coin--{key}"></div>
			{/if}
		</h4>

		<input
			type="number"
			class="nimble-currency-field"
			value={denomination.value}
			onchange={({ target }) =>
				actor.update({
					[`system.currency.${key}.value`]: target.value,
				})}
		/>
	</label>
{/each}

<style lang="scss">
	.nimble-currency-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		align-self: self-end;
		height: 100%;
		width: 100%;
		overflow-x: hidden;
	}

	.nimble-currency-field[type='number'] {
		--input-height: 1.375rem;

		font-size: var(--nimble-sm-text);
		font-weight: 500;
		text-align: center;
		padding: 0 0.125rem;
		color: var(--nimble-dark-text-color);
		background-color: var(--nimble-input-background-color, transparent);
		border: 1px solid var(--nimble-input-border-color, transparent);
		border-radius: 2px;
		outline: none;
		box-shadow: none;

		&::placeholder {
			color: var(--nimble-medium-text-color);
		}

		&:active,
		&:focus {
			border-color: var(--nimble-input-focus-border-color, var(--color-border-highlight));
			outline: none;
			box-shadow: none;
		}
	}

	.nimble-coin {
		position: relative;
		height: 0.625rem;
		width: 0.625rem;
		border-radius: 50%;
		box-shadow: var(--nimble-box-shadow);

		&::after {
			content: '';
			position: absolute;
			display: block;
			top: 50%;
			right: 50%;
			transform: translate(50%, -50%);
			width: 80%;
			height: 80%;
			border-radius: 50%;
		}

		&::before {
			content: '';
			position: absolute;
			display: block;
			top: 50%;
			right: 50%;
			transform: translate(50%, -50%);
			width: 100%;
			height: 100%;
			border-radius: 50%;
		}

		&--cp {
			background: linear-gradient(
				45deg,
				rgba(223, 182, 103, 1) 0%,
				rgba(249, 243, 232, 1) 56%,
				rgba(231, 192, 116, 1) 96%
			);

			&::before {
				background: linear-gradient(135deg, #d19c35 0%, #f7e6c5 50%, #e8b558 100%);
				border: 1px solid #e6b86a;
			}

			&::after {
				background: linear-gradient(
					45deg,
					rgba(223, 182, 103, 1) 0%,
					rgba(249, 243, 232, 1) 56%,
					rgba(231, 192, 116, 1) 96%
				);
				border-top: 1px solid rgba(255, 255, 255, 0.3);
				border-left: 1px solid rgba(255, 255, 255, 0.3);
				border-bottom: 1px solid rgba(209, 156, 53, 0.3);
				border-right: 1px solid rgba(209, 156, 53, 0.5);
				box-shadow: inset 0px 0px 2px 2px rgba(153, 106, 26, 0.05);
			}
		}

		&--gp {
			background: linear-gradient(
				45deg,
				rgba(242, 215, 12, 1) 0%,
				rgba(255, 255, 255, 1) 56%,
				rgba(252, 235, 0, 1) 96%
			);
			filter: saturate(0.95) brightness(0.97);

			&::before {
				background: linear-gradient(
					45deg,
					rgba(242, 215, 12, 1) 0%,
					rgba(255, 255, 255, 1) 56%,
					rgba(252, 235, 0, 1) 96%
				);
				border: 1px solid rgba(242, 215, 12, 1);
			}

			&::after {
				background: linear-gradient(
					45deg,
					rgba(242, 215, 12, 1) 0%,
					rgba(255, 255, 255, 1) 56%,
					rgba(252, 235, 0, 1) 96%
				);
				border-top: 1px solid rgba(255, 255, 255, 0.3);
				border-left: 1px solid rgba(255, 255, 255, 0.3);
				border-bottom: 1px solid rgba(242, 215, 12, 0.3);
				border-right: 1px solid rgba(242, 215, 12, 0.3);
				box-shadow: inset 0px 0px 2px 2px rgba(150, 150, 150, 0.05);
			}
		}

		&--sp {
			background: linear-gradient(45deg, rgba(160, 160, 160, 1) 0%, rgba(232, 232, 232, 1) 56%);

			&::before {
				background: linear-gradient(
					45deg,
					rgba(181, 181, 181, 1) 0%,
					rgba(252, 252, 252, 1) 56%,
					rgba(232, 232, 232, 1) 96%
				);
				border: 1px solid rgba(181, 181, 181, 1);
			}

			&::after {
				background: linear-gradient(
					45deg,
					rgba(181, 181, 181, 1) 0%,
					rgba(252, 252, 252, 1) 56%,
					rgba(232, 232, 232, 1) 96%
				);
				border-top: 1px solid rgba(255, 255, 255, 0.3);
				border-left: 1px solid rgba(255, 255, 255, 0.3);
				border-bottom: 1px solid rgba(160, 160, 160, 0.3);
				border-right: 1px solid rgba(160, 160, 160, 0.5);
				box-shadow: inset 0px 0px 2px 2px rgba(150, 150, 150, 0.05);
			}
		}
	}
</style>
