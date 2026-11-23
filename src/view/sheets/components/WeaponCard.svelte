<script lang="ts">
	import type { WeaponCardProps } from '../../../../types/components/WeaponCard.d.ts';
	import localize from '../../../utils/localize.js';

	import ChargeIndicator from '../../components/ChargeIndicator.svelte';

	let {
		name,
		actor = null,
		pools = undefined,
		image = null,
		icon = 'fa-solid fa-sword',
		damage = null,
		properties = [],
		notice = null,
		noticeLabel = null,
		description = null,
		isExpanded = false,
		disabled = false,
		showImage = true,
		itemId = null,
		active = false,
		onToggleDescription = null,
		onclick,
		ondragstart = null,
	}: WeaponCardProps = $props();
</script>

<li
	class="weapon-card"
	class:weapon-card--expanded={isExpanded}
	class:weapon-card--disabled={disabled}
>
	<div
		class="weapon-card__row"
		role="button"
		tabindex={disabled ? -1 : 0}
		draggable={ondragstart ? 'true' : 'false'}
		data-item-id={itemId}
		{ondragstart}
		onclick={disabled ? null : onclick}
		onkeydown={(e) => {
			if (disabled) return;
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				onclick?.();
			}
		}}
	>
		{#if showImage && image}
			<img class="weapon-card__img" src={image} alt={name} />
		{:else}
			<div class="weapon-card__icon">
				<i class={icon}></i>
			</div>
		{/if}

		<div class="weapon-card__content">
			<div class="weapon-card__header">
				<span class="weapon-card__name">{name}</span>
				{#if actor && itemId}
					<ChargeIndicator {actor} {itemId} {pools} />
				{/if}
			</div>
			{#if properties.length > 0 || active}
				<div class="weapon-card__meta">
					{#if active}
						<span class="weapon-card__tag weapon-card__tag--active">
							{localize('NIMBLE.ui.heroicActions.active')}
						</span>
					{/if}
					{#each properties as prop}
						<span class="weapon-card__tag">{prop}</span>
					{/each}
				</div>
			{/if}
			{#if notice}
				<span
					class="weapon-card__notice"
					data-tooltip={notice}
					data-tooltip-direction="UP"
					aria-label={notice}
				>
					<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
					<span>{noticeLabel || notice}</span>
				</span>
			{/if}
		</div>

		{#if damage}
			<span class="weapon-card__damage">
				<i class="fa-solid fa-burst"></i>
				{damage}
			</span>
		{/if}

		{#if description && onToggleDescription}
			<button
				class="weapon-card__expand"
				type="button"
				onclick={onToggleDescription}
				aria-label={localize(
					isExpanded ? 'NIMBLE.ui.heroicActions.collapse' : 'NIMBLE.ui.heroicActions.expand',
				)}
			>
				<i class="fa-solid fa-caret-{isExpanded ? 'up' : 'down'}"></i>
			</button>
		{/if}
	</div>

	{#if isExpanded && description}
		<div class="weapon-card__description">
			{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(description) then enrichedDescription}
				{@html enrichedDescription}
			{:catch}
				{@html description}
			{/await}
		</div>
	{/if}
</li>

<style lang="scss">
	.weapon-card {
		display: flex;
		flex-direction: column;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		transition: var(--nimble-standard-transition);

		&:hover:not(.weapon-card--disabled) {
			border-color: var(--nimble-box-color);
			box-shadow: var(--nimble-box-shadow);
		}

		&--disabled {
			opacity: 0.5;
		}

		&__row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem;
			cursor: pointer;
			background: transparent;
			border: none;
			text-align: left;
			width: 100%;

			&:disabled {
				cursor: not-allowed;
			}
		}

		&__icon {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 3px;
			flex-shrink: 0;

			i {
				font-size: 1rem;
				color: var(--nimble-medium-text-color);
			}
		}

		&__img {
			width: 2rem;
			height: 2rem;
			object-fit: cover;
			border-radius: 3px;
			flex-shrink: 0;
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
			min-width: 0;
		}

		&__header {
			display: flex;
			align-items: center;
			flex-wrap: wrap;
			gap: 0.375rem;
		}

		&__notice {
			display: flex;
			align-items: flex-start;
			gap: 0.25rem;
			min-width: 0;
			font-size: var(--nimble-xs-text);
			line-height: 1.3;
			// The shared icon colour is a dark brown for a pale warning chip. On this
			// card the sentence sits on the card fill, so dark mode needs a light amber.
			color: var(--nimble-warning-icon-color);

			span {
				min-width: 0;
			}

			:global(.theme-dark) & {
				color: hsl(45, 85%, 68%);
			}
		}

		&__name {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			line-height: 1.2;
		}

		&__meta {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.25rem;
		}

		&__tag {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			padding: 0 0.25rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 2px;
		}

		&__tag--active {
			font-weight: 700;
			color: var(--nimble-weapon-active-color);
		}

		&__damage {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.25rem 0.625rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-basic-button-background-color);
			border-radius: 3px;
			flex-shrink: 0;

			i {
				font-size: 0.875rem;
				color: hsl(0, 60%, 50%);
			}
		}

		&__expand {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.5rem;
			height: 1.5rem;
			padding: 0;
			background: transparent;
			border: none;
			border-radius: 3px;
			cursor: pointer;
			flex-shrink: 0;
			color: var(--nimble-medium-text-color);
			transition: all 0.15s ease;

			&:hover {
				background: var(--nimble-basic-button-background-color);
				color: var(--nimble-dark-text-color);
			}

			i {
				font-size: 0.875rem;
			}
		}

		&__description {
			padding: 0.5rem 0.75rem;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-dark-text-color);
			border-top: 1px solid var(--nimble-card-border-color);
			line-height: 1.5;

			:global(p) {
				margin: 0 0 0.5rem;

				&:last-child {
					margin-bottom: 0;
				}
			}
		}
	}
</style>
