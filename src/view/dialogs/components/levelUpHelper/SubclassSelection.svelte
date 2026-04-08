<script>
	import SelectionIndicator from '#view/components/SelectionIndicator.svelte';
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
							<SelectionIndicator
								selected={subclass.uuid === selectedSubclass?.uuid}
								onclick={(e) => handleSelectClick(subclass.uuid, e)}
								tooltip={subclass.uuid === selectedSubclass?.uuid
									? localize('NIMBLE.subclassSelection.deselectSubclass')
									: localize('NIMBLE.subclassSelection.selectSubclass')}
								ariaLabel={subclass.uuid === selectedSubclass?.uuid
									? localize('NIMBLE.subclassSelection.deselectSubclassAriaLabel', {
											subclassName: subclass.name,
										})
									: localize('NIMBLE.subclassSelection.selectSubclassAriaLabel', {
											subclassName: subclass.name,
										})}
							/>
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
