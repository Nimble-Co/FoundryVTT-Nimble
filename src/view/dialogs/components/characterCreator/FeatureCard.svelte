<script lang="ts">
	import type { FeatureCardProps } from '#types/components/ClassFeatureSelection.d.ts';

	let { feature, isSelected = false, onSelect }: FeatureCardProps = $props();

	let isExpanded = $state(false);
	let enrichedDescription = $state('');

	$effect(() => {
		if (feature?.system?.description) {
			foundry.applications.ux.TextEditor.implementation
				.enrichHTML(feature.system.description)
				.then((html: string) => {
					enrichedDescription = html;
				});
		} else {
			enrichedDescription = '';
		}
	});

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	function handleSelect() {
		onSelect?.();
	}

	function viewDetails(event: MouseEvent) {
		event.stopPropagation();
		feature.sheet?.render(true);
	}
</script>

<li class="feature-item">
	<div
		class="feature-row"
		class:selected={isSelected}
		class:expanded={isExpanded}
		onclick={toggleExpanded}
		role="button"
		tabindex="0"
		onkeydown={(e) => e.key === 'Enter' && toggleExpanded()}
	>
		{#if !isSelected}
			<i class="fa-solid fa-chevron-up expand-arrow"></i>
		{/if}

		<img
			class="feature-row__img"
			src={feature.img || 'icons/svg/item-bag.svg'}
			alt={feature.name}
		/>

		<h4 class="feature-row__name nimble-heading" data-heading-variant="item">
			{feature.name}
		</h4>

		<button
			class="view-details-button"
			onclick={viewDetails}
			title="View Details"
			aria-label="View {feature.name} details"
		>
			<i class="fa-solid fa-book-open"></i>
		</button>
	</div>

	{#if isExpanded}
		<div class="accordion-content">
			<div class="description">
				{#if enrichedDescription}
					{@html enrichedDescription}
				{:else}
					<p>No description available.</p>
				{/if}
			</div>

			{#if onSelect}
				<button
					class="nimble-button"
					data-button-variant="full-width"
					type="button"
					onclick={handleSelect}
				>
					{#if isSelected}
						<i class="fa-solid fa-check"></i>
						Selected
					{:else}
						Confirm Selection
					{/if}
				</button>
			{/if}
		</div>
	{/if}
</li>

<style lang="scss">
	.feature-item {
		margin-bottom: 0.5rem;
		list-style: none;
	}

	.feature-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 50px;
		padding: 0.5rem;
		position: relative;
		cursor: pointer;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		transition: all 0.3s ease;

		&:hover {
			border-color: var(--nimble-accent-color);
		}

		&.selected {
			border-color: var(--nimble-accent-color);
			background: color-mix(
				in srgb,
				var(--nimble-accent-color) 10%,
				var(--nimble-box-background-color)
			);
		}

		&.expanded {
			border-bottom-left-radius: 0;
			border-bottom-right-radius: 0;

			.expand-arrow {
				transform: rotate(180deg);
			}
		}

		.expand-arrow {
			font-size: 0.875rem;
			transition: transform 0.3s ease;
			color: var(--nimble-medium-text-color);
		}

		.feature-row__img {
			width: 36px;
			height: 36px;
			margin: 0;
			padding: 0;
			display: block;
			border-radius: 4px;
			object-fit: cover;
		}

		.feature-row__name {
			flex: 1;
			margin: 0;
			padding: 0;
			line-height: 1;
		}
	}

	.view-details-button {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--nimble-accent-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		color: var(--nimble-light-text-color);
		cursor: pointer;
		transition: all 0.2s ease;
		z-index: 1;

		&:hover {
			filter: brightness(1.2);
			transform: scale(1.05);
		}

		i {
			font-size: 0.875rem;
		}
	}

	.accordion-content {
		background: transparent;
		border: 1px solid var(--nimble-card-border-color);
		border-top: none;
		border-radius: 0 0 4px 4px;
		padding: 0.75rem;
		animation: slideDown 0.3s ease;

		.description {
			margin-bottom: 0.5rem;
			max-height: 300px;
			overflow-y: auto;
			line-height: 1.5;

			:global(h3) {
				margin-top: 0.5rem;
				margin-bottom: 0.25rem;
				font-size: 0.95rem;
				font-weight: 600;
			}

			:global(p) {
				margin-bottom: 0.5rem;

				&:last-child {
					margin-bottom: 0;
				}
			}
		}
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			max-height: 0;
			padding-top: 0;
			padding-bottom: 0;
		}
		to {
			opacity: 1;
			max-height: 400px;
			padding-top: 0.75rem;
			padding-bottom: 0.75rem;
		}
	}
</style>
