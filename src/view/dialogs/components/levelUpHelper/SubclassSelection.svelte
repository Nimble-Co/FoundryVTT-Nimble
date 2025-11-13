<script>
	let { subclasses, selectedSubclass = $bindable() } = $props();

	let expandedSubclassUuid = $state(null);
	let expandedSubclassData = $state(null);

	async function toggleExpanded(subclassUuid) {
		if (expandedSubclassUuid === subclassUuid) {
			expandedSubclassUuid = null;
			expandedSubclassData = null;
		} else {
			expandedSubclassUuid = subclassUuid;
			selectedSubclass = null;
			expandedSubclassData = await fromUuid(subclassUuid);
		}
	}

	async function confirmSelection(subclassUuid) {
		selectedSubclass = await fromUuid(subclassUuid);
		expandedSubclassUuid = null;
		expandedSubclassData = null;
	}

	async function viewSubclass(subclassUuid, event) {
		event.stopPropagation();
		const subclass = await fromUuid(subclassUuid);
		subclass?.sheet?.render(true);
	}
</script>

<section class="subclass-selection">
	<header>
		<h3 class="nimble-heading" data-heading-variant="section">Subclass</h3>
	</header>

	{#if subclasses.length > 0}
		<ul class="nimble-document-list">
			{#each subclasses as subclass}
				{#if subclass?.uuid === selectedSubclass?.uuid || !selectedSubclass}
					<li class="u-semantic-only subclass-item">
						<div
							class="subclass-row"
							class:selected={subclass?.uuid === selectedSubclass?.uuid}
							class:expanded={expandedSubclassUuid === subclass.uuid}
							onclick={() => toggleExpanded(subclass.uuid)}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && toggleExpanded(subclass.uuid)}
						>
							{#if subclass?.uuid !== selectedSubclass?.uuid}
								<i class="fa-solid fa-chevron-up expand-arrow"></i>
							{/if}
							<img
								class="subclass-row__img"
								src={subclass.img || 'icons/svg/item-bag.svg'}
								alt={subclass.name}
								onerror={(e) => {
									subclass.img = 'icons/svg/item-bag.svg';
								}}
							/>

							<h4 class="subclass-row__name nimble-heading" data-heading-variant="item">
								{subclass.name}
							</h4>
							<button
								class="view-details-button"
								onclick={(e) => viewSubclass(subclass.uuid, e)}
								title="View Details"
								aria-label="View {subclass.name} details"
							>
								<i class="fa-solid fa-book-open"></i>
							</button>
						</div>

						{#if expandedSubclassUuid === subclass.uuid}
							<div class="accordion-content">
								<div class="description">
									{@html expandedSubclassData?.system?.description || 'Loading...'}
								</div>
								<button
									class="nimble-button"
									data-button-variant="full-width"
									type="button"
									onclick={(e) => confirmSelection(subclass.uuid, e)}
								>
									Confirm Selection
								</button>
							</div>
						{/if}
					</li>
				{/if}
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
		background: var(--nimble-color-bg-secondary, #2a2a2a);
		border: 1px solid var(--nimble-color-border, #444);
		border-radius: 4px;
		transition: all 0.3s ease;

		&:hover {
			border-color: var(--nimble-color-primary, #4a90e2);
		}

		&.selected {
			border-color: var(--nimble-color-primary, #4a90e2);
			background: rgba(74, 144, 226, 0.1);
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
			color: var(--nimble-color-text-secondary, #999);
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
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
		z-index: 1;

		&:hover {
			background: rgba(0, 0, 0, 0.7);
			border-color: rgba(255, 255, 255, 0.4);
			transform: scale(1.05);
		}

		i {
			font-size: 0.875rem;
		}
	}

	.accordion-content {
		background: var(--nimble-color-bg-secondary, #2a2a2a);
		border: 1px solid var(--nimble-color-border, #444);
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
