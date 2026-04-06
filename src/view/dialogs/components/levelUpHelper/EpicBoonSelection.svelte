<script lang="ts">
	import localize from '#utils/localize.js';

	interface EpicBoon {
		uuid: string;
		name: string;
		img: string;
		system: { boonType: string; description: string };
	}

	interface Props {
		epicBoons: EpicBoon[];
		selectedEpicBoon: object | null;
	}

	let { epicBoons, selectedEpicBoon = $bindable() }: Props = $props();

	let expandedBoonUuids: Set<string> = $state(new Set());
	let expandedBoonDataMap: Map<string, { system?: { description?: string } }> = $state(new Map());

	// Filter to show only selected boon when one is selected
	const displayedBoons = $derived(
		selectedEpicBoon
			? epicBoons.filter((b) => b.uuid === (selectedEpicBoon as { uuid?: string }).uuid)
			: epicBoons,
	);

	async function toggleExpanded(boonUuid: string) {
		if (expandedBoonUuids.has(boonUuid)) {
			expandedBoonUuids.delete(boonUuid);
			expandedBoonUuids = new Set(expandedBoonUuids);
			expandedBoonDataMap.delete(boonUuid);
			expandedBoonDataMap = new Map(expandedBoonDataMap);
		} else {
			const boonData = await fromUuid(boonUuid);
			expandedBoonUuids.add(boonUuid);
			expandedBoonUuids = new Set(expandedBoonUuids);
			expandedBoonDataMap.set(boonUuid, boonData as { system?: { description?: string } });
			expandedBoonDataMap = new Map(expandedBoonDataMap);
		}
	}

	async function handleSelectClick(boonUuid: string, event: MouseEvent) {
		event.stopPropagation();

		// If already selected, deselect
		if ((selectedEpicBoon as { uuid?: string })?.uuid === boonUuid) {
			selectedEpicBoon = null;
		} else {
			// Select this boon
			selectedEpicBoon = await fromUuid(boonUuid);
		}
	}

	function handleRowClick(boonUuid: string) {
		toggleExpanded(boonUuid);
	}

	function handleKeydown(e: KeyboardEvent, boonUuid: string) {
		if (e.key === 'Enter') {
			handleRowClick(boonUuid);
		}
	}
</script>

<section class="epic-boon-selection">
	<header>
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.epicBoonSelection.header')}
		</h3>
		<p class="nimble-hint">{localize('NIMBLE.epicBoonSelection.hint')}</p>
	</header>

	{#if epicBoons.length > 0}
		<ul class="nimble-document-list">
			{#each displayedBoons as boon (boon.uuid)}
				<li class="u-semantic-only boon-item">
					<div
						class="boon-row"
						class:selected={boon.uuid === (selectedEpicBoon as { uuid?: string })?.uuid}
						class:expanded={expandedBoonUuids.has(boon.uuid)}
						onclick={() => handleRowClick(boon.uuid)}
						role="button"
						tabindex="0"
						onkeydown={(e) => handleKeydown(e, boon.uuid)}
					>
						<i class="fa-solid fa-chevron-down expand-arrow"></i>

						<img
							class="boon-row__img"
							src={boon.img || 'icons/svg/item-bag.svg'}
							alt={boon.name}
							onerror={() => {
								boon.img = 'icons/svg/item-bag.svg';
							}}
						/>

						<h4 class="boon-row__name nimble-heading" data-heading-variant="item">
							{boon.name}
						</h4>

						<div class="boon-row__actions">
							<button
								type="button"
								class="select-button"
								class:selected={boon.uuid === (selectedEpicBoon as { uuid?: string })?.uuid}
								onclick={(e) => handleSelectClick(boon.uuid, e)}
								data-tooltip={boon.uuid === (selectedEpicBoon as { uuid?: string })?.uuid
									? localize('NIMBLE.epicBoonSelection.deselectBoon')
									: localize('NIMBLE.epicBoonSelection.selectBoon')}
								data-tooltip-direction="LEFT"
								aria-label={boon.uuid === (selectedEpicBoon as { uuid?: string })?.uuid
									? localize('NIMBLE.epicBoonSelection.deselectBoonAriaLabel', {
											boonName: boon.name,
										})
									: localize('NIMBLE.epicBoonSelection.selectBoonAriaLabel', {
											boonName: boon.name,
										})}
							>
								{#if boon.uuid === (selectedEpicBoon as { uuid?: string })?.uuid}
									<i class="fa-solid fa-check"></i>
								{/if}
							</button>
						</div>
					</div>

					{#if expandedBoonUuids.has(boon.uuid)}
						<div class="accordion-content">
							<div class="description">
								{@html expandedBoonDataMap.get(boon.uuid)?.system?.description || 'Loading...'}
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="nimble-hint">
			{localize('NIMBLE.epicBoonSelection.noBoons')}
		</p>
	{/if}
</section>

<style lang="scss">
	.epic-boon-selection {
		margin-top: 1rem;

		.nimble-heading {
			margin: 1rem 0 0.5rem 0;
		}

		.nimble-hint {
			margin: 0 0 1rem 0;
			font-size: var(--nimble-sm-text);
			color: var(--nimble-medium-text-color);
		}
	}

	.boon-item {
		margin-bottom: 0.5rem;
	}

	.boon-row {
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

		.boon-row__img {
			width: 36px;
			height: 36px;
			margin: 0;
			padding: 0;
			display: block;
			border-radius: 4px;
		}

		.boon-row__name {
			flex: 1;
			margin: 0;
			padding: 0;
			line-height: 1;
		}

		.boon-row__actions {
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
		padding: 0.5rem 0.75rem;
		animation: slideDown 0.3s ease;

		.description {
			margin-bottom: 0;
			max-height: 300px;
			overflow-y: auto;
			line-height: 1.5;

			:global(h3) {
				margin-top: 0.25rem;
				margin-bottom: 0.25rem;
				font-size: 0.95rem;
				font-weight: 600;
			}

			:global(p) {
				margin-bottom: 0.25rem;
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
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
		}
	}
</style>
