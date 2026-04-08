<script lang="ts">
	import { ChargeUiConfig } from '#utils/chargeUiConfig.js';
	import localize from '#utils/localize.js';
	import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

	import CardHeader from './components/CardHeader.svelte';

	let { messageDocument } = $props();

	const system = $derived(messageDocument.reactive.system);
	const pools = $derived(system.pools ?? []);
	const itemName = $derived(system.itemName ?? localize(ChargeUiConfig.unknownItemLocalizationKey));

	const headerBackgroundColor = $derived(messageDocument.reactive.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));
</script>

<CardHeader {messageDocument} />

<article
	class="nimble-chat-card__body"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<div class="nimble-charge-adjustment">
		<div class="nimble-charge-adjustment__header">
			<i class="fa-solid fa-bolt"></i>
			<strong>{itemName}</strong>
		</div>
		<p class="nimble-charge-adjustment__subtext">{CONFIG.NIMBLE.charges.manuallyAdjusted}</p>
		<ul class="nimble-charge-adjustment__list">
			{#each pools as pool}
				<li class="nimble-charge-adjustment__item">
					{#if pool.icon}
						<i class={pool.icon}></i>
					{:else}
						<i class={ChargeUiConfig.defaultPoolIcon}></i>
					{/if}
					<span class="nimble-charge-adjustment__label">{pool.label}</span>
					<span class="nimble-charge-adjustment__values">
						{pool.previousValue} → {pool.newValue}
					</span>
				</li>
			{/each}
		</ul>
	</div>
</article>

<style lang="scss">
	.nimble-charge-adjustment {
		--nimble-charge-adjustment-highlight-color: hsl(45, 70%, 40%);
		--nimble-charge-adjustment-dark-header-color: hsl(0, 0%, 90%);
		--nimble-charge-adjustment-dark-highlight-color: hsl(45, 80%, 60%);
		--nimble-charge-adjustment-dark-subtext-color: hsl(0, 0%, 70%);
		--nimble-charge-adjustment-dark-item-background: hsl(220, 15%, 12%);
		--nimble-charge-adjustment-dark-item-border: hsl(220, 10%, 25%);
		--nimble-charge-adjustment-dark-icon-color: hsl(220, 10%, 60%);
		--nimble-charge-adjustment-dark-text-color: hsl(220, 10%, 85%);
		padding: 0.5rem;

		&__header {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			color: var(--nimble-dark-text-color);

			i {
				color: var(--nimble-charge-adjustment-highlight-color);
			}
		}

		&__subtext {
			font-size: var(--nimble-xs-text);
			color: var(--nimble-medium-text-color);
			margin: 0.25rem 0 0.5rem 1.5rem;
		}

		&__list {
			list-style: none;
			margin: 0;
			padding: 0;
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__item {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.375rem 0.5rem;
			background: var(--nimble-box-background-color);
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;

			i {
				color: var(--nimble-medium-text-color);
				font-size: var(--nimble-sm-text);
				width: 1.25rem;
				text-align: center;
			}
		}

		&__label {
			flex: 1;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
		}

		&__values {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}
	}

	:global(.theme-dark) {
		.nimble-charge-adjustment {
			&__header {
				color: var(--nimble-charge-adjustment-dark-header-color);

				i {
					color: var(--nimble-charge-adjustment-dark-highlight-color);
				}
			}

			&__subtext {
				color: var(--nimble-charge-adjustment-dark-subtext-color);
			}

			&__item {
				background: var(--nimble-charge-adjustment-dark-item-background);
				border-color: var(--nimble-charge-adjustment-dark-item-border);

				i {
					color: var(--nimble-charge-adjustment-dark-icon-color);
				}
			}

			&__label {
				color: var(--nimble-charge-adjustment-dark-text-color);
			}

			&__values {
				color: var(--nimble-charge-adjustment-dark-text-color);
			}
		}
	}
</style>
