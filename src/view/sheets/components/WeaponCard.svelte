<script>
	import localize from '../../../utils/localize.js';

	let {
		name,
		image = null,
		icon = 'fa-solid fa-sword',
		damage = null,
		properties = [],
		description = null,
		isExpanded = false,
		disabled = false,
		showImage = true,
		itemId = null,
		onToggleDescription = null,
		onclick,
		ondragstart = null,
	} = $props();
</script>

<li
	class="weapon-card"
	class:weapon-card--expanded={isExpanded}
	class:weapon-card--disabled={disabled}
	data-item-id={itemId}
>
	<div
		class="weapon-card__row"
		role="button"
		tabindex={disabled ? -1 : 0}
		draggable={ondragstart ? 'true' : 'false'}
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
			<span class="weapon-card__name">{name}</span>
			{#if properties.length > 0}
				<div class="weapon-card__meta">
					{#each properties as prop}
						<span class="weapon-card__tag">{prop}</span>
					{/each}
				</div>
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
