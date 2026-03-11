<script>
	let {
		icon = 'fa-solid fa-bolt',
		label = 'Action',
		description = '',
		tooltip = '',
		disabled = false,
		expanded = false,
		onclick = () => {},
	} = $props();
</script>

<button
	class="heroic-action-box"
	class:heroic-action-box--disabled={disabled}
	class:heroic-action-box--expanded={expanded}
	type="button"
	data-tooltip={tooltip || null}
	{disabled}
	{onclick}
>
	<div class="heroic-action-box__icon-wrapper">
		<i class="heroic-action-box__icon {icon}"></i>
	</div>

	<div class="heroic-action-box__content">
		<span class="heroic-action-box__label">{label}</span>
		{#if description}
			<span class="heroic-action-box__description">{description}</span>
		{/if}
	</div>

	{#if expanded}
		<i class="heroic-action-box__chevron fa-solid fa-chevron-up"></i>
	{/if}
</button>

<style lang="scss">
	.heroic-action-box {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		min-height: 4rem;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
		transition: var(--nimble-standard-transition);

		&:hover:not(:disabled) {
			border-color: var(--nimble-box-color);
			box-shadow: var(--nimble-box-shadow);
		}

		&--expanded {
			border-color: var(--nimble-box-color);
			background: var(--nimble-input-background-color);
		}

		&--disabled {
			cursor: not-allowed;
			opacity: 0.5;
		}

		&__icon-wrapper {
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
			width: 2.5rem;
			height: 2.5rem;
			background: var(--nimble-action-button-icon-color);
			border-radius: 4px;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

			.heroic-action-box--disabled & {
				background: var(--nimble-medium-text-color);
			}
		}

		&__icon {
			font-size: 1.125rem;
			color: hsl(0, 0%, 100%);
			text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
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
			line-height: 1.3;
		}

		&__description {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			line-height: 1.3;
		}

		&__chevron {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
			font-size: 0.5rem;
			color: var(--nimble-medium-text-color);
		}
	}
</style>
