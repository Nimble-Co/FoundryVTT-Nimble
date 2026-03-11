<script>
	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import { createAttackPanelState } from './AttackActionPanel.svelte.js';

	import SearchBar from './SearchBar.svelte';

	let actor = getContext('actor');
	let sheet = getContext('application');

	let { onActivateItem = async () => {}, showEmbeddedDocumentImages = true } = $props();

	const state = createAttackPanelState(actor, onActivateItem);
</script>

<section class="attack-panel">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.ui.heroicActions.selectAttack')}
		</h3>
	</header>

	<div class="attack-panel__search">
		<SearchBar bind:searchTerm={state.searchTerm} />
	</div>

	<div class="attack-panel__content">
		<ul class="attack-panel__list">
			{#if state.showUnarmedStrike}
				<li class="weapon-card">
					<div
						class="weapon-card__row"
						role="button"
						tabindex="0"
						onclick={state.handleUnarmedStrike}
						onkeydown={(e) => state.handleKeydown(e, state.handleUnarmedStrike)}
					>
						<div class="weapon-card__icon">
							<i class="fa-solid fa-hand-fist"></i>
						</div>

						<div class="weapon-card__content">
							<span class="weapon-card__name">
								{localize('NIMBLE.ui.heroicActions.unarmedStrike')}
							</span>
							<div class="weapon-card__meta">
								<span class="weapon-card__tag">{localize('NIMBLE.npcSheet.melee')}</span>
							</div>
						</div>

						<span class="weapon-card__damage">
							<i class="fa-solid fa-burst"></i>
							{state.getUnarmedDamageDisplay()}
						</span>
					</div>
				</li>
			{/if}

			{#each state.sortItems(state.weapons) as item (item._id)}
				{@const damage = state.getWeaponDamage(item)}
				{@const properties = state.getWeaponProperties(item)}
				{@const isExpanded = state.expandedDescriptions.has(item._id)}
				{@const description = state.getItemDescription(item)}
				<li class="weapon-card" class:weapon-card--expanded={isExpanded} data-item-id={item._id}>
					<div
						class="weapon-card__row"
						role="button"
						tabindex="0"
						draggable="true"
						ondragstart={(event) => sheet._onDragStart(event)}
						onclick={() => state.handleItemClick(item._id)}
						onkeydown={(e) => state.handleKeydown(e, () => state.handleItemClick(item._id))}
					>
						{#if showEmbeddedDocumentImages}
							<img class="weapon-card__img" src={item.reactive.img} alt={item.reactive.name} />
						{/if}

						<div class="weapon-card__content">
							<span class="weapon-card__name">{item.reactive.name}</span>
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

						{#if description}
							<button
								class="weapon-card__expand"
								type="button"
								onclick={(e) => state.toggleDescription(item._id, e)}
								aria-label={localize(
									isExpanded
										? 'NIMBLE.ui.heroicActions.collapse'
										: 'NIMBLE.ui.heroicActions.expand',
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
			{/each}

			{#each state.sortItems(state.attackFeatures) as item (item._id)}
				{@const damage = state.getWeaponDamage(item)}
				{@const isExpanded = state.expandedDescriptions.has(item._id)}
				{@const description = state.getItemDescription(item)}
				<li class="weapon-card" class:weapon-card--expanded={isExpanded} data-item-id={item._id}>
					<div
						class="weapon-card__row"
						role="button"
						tabindex="0"
						draggable="true"
						ondragstart={(event) => sheet._onDragStart(event)}
						onclick={() => state.handleItemClick(item._id)}
						onkeydown={(e) => state.handleKeydown(e, () => state.handleItemClick(item._id))}
					>
						{#if showEmbeddedDocumentImages}
							<img class="weapon-card__img" src={item.reactive.img} alt={item.reactive.name} />
						{/if}

						<div class="weapon-card__content">
							<span class="weapon-card__name">{item.reactive.name}</span>
							<div class="weapon-card__meta">
								<span class="weapon-card__tag">{localize('NIMBLE.ui.heroicActions.feature')}</span>
							</div>
						</div>

						{#if damage}
							<span class="weapon-card__damage">
								<i class="fa-solid fa-burst"></i>
								{damage}
							</span>
						{/if}

						{#if description}
							<button
								class="weapon-card__expand"
								type="button"
								onclick={(e) => state.toggleDescription(item._id, e)}
								aria-label={localize(
									isExpanded
										? 'NIMBLE.ui.heroicActions.collapse'
										: 'NIMBLE.ui.heroicActions.expand',
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
			{/each}
		</ul>

		{#if !state.showUnarmedStrike && state.weapons.length === 0 && state.attackFeatures.length === 0}
			<p class="attack-panel__empty">{localize('NIMBLE.ui.heroicActions.noWeapons')}</p>
		{/if}
	</div>
</section>

<style lang="scss">
	.attack-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__search {
			display: flex;
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			max-height: 300px;
			overflow-y: auto;
		}

		&__list {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__empty {
			margin: 0;
			padding: 0.75rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			text-align: center;
			color: var(--nimble-medium-text-color);
		}
	}

	.weapon-card {
		display: flex;
		flex-direction: column;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		transition: var(--nimble-standard-transition);

		&:hover {
			border-color: var(--nimble-box-color);
			box-shadow: var(--nimble-box-shadow);
		}

		&__row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem;
			cursor: pointer;
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
