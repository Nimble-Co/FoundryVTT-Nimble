<script>
	import localize from '#utils/localize.js';

	let { subclasses, selectedSubclass = $bindable() } = $props();

	let expandedSubclassUuid = $state(null);
	let expandedSubclassData = $state(null);

	// Filter to show only selected subclass when one is selected
	const displayedSubclasses = $derived(
		selectedSubclass ? subclasses.filter((s) => s.uuid === selectedSubclass.uuid) : subclasses,
	);

	async function toggleExpanded(subclassUuid) {
		if (expandedSubclassUuid === subclassUuid) {
			expandedSubclassUuid = null;
			expandedSubclassData = null;
		} else {
			expandedSubclassUuid = subclassUuid;
			expandedSubclassData = await fromUuid(subclassUuid);
		}
	}

	async function handleSelectClick(subclassUuid, event) {
		event.stopPropagation();

		// If already selected, deselect
		if (selectedSubclass?.uuid === subclassUuid) {
			selectedSubclass = null;
		} else {
			// Select this subclass
			selectedSubclass = await fromUuid(subclassUuid);
		}
	}

	function handleRowClick(subclassUuid) {
		toggleExpanded(subclassUuid);
	}

	function handleKeydown(e, subclassUuid) {
		if (e.key === 'Enter') {
			handleRowClick(subclassUuid);
		}
	}
</script>

<section class="subclass-selection">
	<header>
		<h3 class="nimble-heading" data-heading-variant="section">Subclass</h3>
	</header>

	{#if subclasses.length > 0}
		<ul class="nimble-document-list">
			{#each displayedSubclasses as subclass (subclass.uuid)}
				<li class="u-semantic-only subclass-item">
					<div
						class="subclass-row"
						class:selected={subclass.uuid === selectedSubclass?.uuid}
						class:expanded={expandedSubclassUuid === subclass.uuid}
						onclick={() => handleRowClick(subclass.uuid)}
						role="button"
						tabindex="0"
						onkeydown={(e) => handleKeydown(e, subclass.uuid)}
					>
						<i class="fa-solid fa-chevron-down expand-arrow"></i>

						<img
							class="subclass-row__img"
							src={subclass.img || 'icons/svg/item-bag.svg'}
							alt={subclass.name}
							onerror={(_e) => {
								subclass.img = 'icons/svg/item-bag.svg';
							}}
						/>

						<h4 class="subclass-row__name nimble-heading" data-heading-variant="item">
							{subclass.name}
						</h4>

						<div class="subclass-row__actions">
							<button
								type="button"
								class="select-button"
								class:selected={subclass.uuid === selectedSubclass?.uuid}
								onclick={(e) => handleSelectClick(subclass.uuid, e)}
								data-tooltip={subclass.uuid === selectedSubclass?.uuid
									? localize('NIMBLE.subclassSelection.deselectSubclass')
									: localize('NIMBLE.subclassSelection.selectSubclass')}
								data-tooltip-direction="LEFT"
								aria-label={subclass.uuid === selectedSubclass?.uuid
									? localize('NIMBLE.subclassSelection.deselectSubclassAriaLabel', {
											subclassName: subclass.name,
										})
									: localize('NIMBLE.subclassSelection.selectSubclassAriaLabel', {
											subclassName: subclass.name,
										})}
							>
								{#if subclass.uuid === selectedSubclass?.uuid}
									<i class="fa-solid fa-check"></i>
								{/if}
							</button>
						</div>
					</div>

					{#if expandedSubclassUuid === subclass.uuid}
						<div class="accordion-content">
							<div class="description">
								{@html expandedSubclassData?.system?.description || 'Loading...'}
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="nimble-hint">
			No subclasses available for this class. You may need to create or import subclass items.
		</p>
	{/if}
</section>

<style lang="scss">
	.subclass-selection {
		margin-top: 1rem;

		.nimble-heading {
			margin: 1rem 0 1rem 0;
		}
	}

	.subclass-item {
		margin-bottom: 0.5rem;
	}

	.subclass-row {
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

		.subclass-row__img {
			width: 36px;
			height: 36px;
			margin: 0;
			padding: 0;
			display: block;
			border-radius: 4px;
		}

		.subclass-row__name {
			flex: 1;
			margin: 0;
			padding: 0;
			line-height: 1;
		}

		.subclass-row__actions {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin-left: auto;
		}
	}

	.select-button {
		width: 1.25rem;
		min-width: 1.25rem;
		max-width: 1.25rem;
		height: 1.25rem;
		min-height: 1.25rem;
		max-height: 1.25rem;
		padding: 0;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--nimble-medium-text-color) 15%, transparent);
		border: 2px solid color-mix(in srgb, var(--nimble-medium-text-color) 60%, transparent);
		border-radius: 50%;
		box-sizing: border-box;
		color: transparent;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover:not(:disabled) {
			border-color: color-mix(in srgb, var(--nimble-medium-text-color) 80%, transparent);
			background: color-mix(in srgb, var(--nimble-medium-text-color) 35%, transparent);
		}

		&.selected {
			background: var(--nimble-accent-color);
			border-color: var(--nimble-accent-color);
			color: #fff;

			&:hover:not(:disabled) {
				filter: brightness(1.15);
			}
		}

		&:disabled {
			opacity: 0.3;
			cursor: not-allowed;
		}

		i {
			font-size: 0.625rem;
		}
	}

	.accordion-content {
		background: transparent;
		border: 1px solid var(--nimble-card-border-color);
		border-top: none;
		border-radius: 0 0 4px 4px;
		padding: 1rem;
		animation: slideDown 0.3s ease;

		.description {
			margin-bottom: 1rem;
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
			padding-top: 1rem;
			padding-bottom: 1rem;
		}
	}
</style>
