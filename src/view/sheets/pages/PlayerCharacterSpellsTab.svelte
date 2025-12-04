<script>
	import filterItems from '../../dataPreparationHelpers/filterItems.js';
	import { getContext } from 'svelte';
	import prepareSpellTooltip from '../../dataPreparationHelpers/documentTooltips/prepareSpellTooltip';
	import sortItems from '../../../utils/sortItems.js';

	import SearchBar from '../components/SearchBar.svelte';
	import SecondaryNavigation from '../../components/SecondaryNavigation.svelte';

	async function configureItem(event, id) {
		event.stopPropagation();

		await actor.configureItem(id);
	}

	async function createItem(event) {
		event.stopPropagation();

		await actor.createItem({ name: 'New Spell', type: 'spell' });
	}

	async function deleteItem(event, id) {
		event.stopPropagation();

		await actor.deleteItem(id);

		if (foundry.utils.isEmpty(visibleSpells)) {
			currentTab = subNavigation[0];
		}
	}

	function getSpellMetadata(spell) {
		const activationType = spell.reactive.system.activation.cost.type;
		const activationCost = spell.reactive.system.activation.cost.quantity;
		const activationCostDetails = spell.reactive.system.activation.cost.details;

		if (!activationType || activationType === 'none') return null;

		if (['action', 'minute', 'hour'].includes(activationType)) {
			const activationTypeLabel =
				activationCost > 1
					? activationCostTypesPlural[activationType]
					: activationCostTypes[activationType];

			return `${activationCost || 1} ${activationTypeLabel}`;
		}

		if (activationType === 'reaction') {
			let label = activationCostTypes[activationType];

			if (activationCostDetails) {
				label += ` <i
                    class="nimble-document-card__meta-icon fa-solid fa-circle-info"
                    data-tooltip="Reaction Trigger: ${activationCostDetails}"
                    data-tooltip-direction="UP"
                ></i>`;
			}

			return label;
		}

		if (activationType === 'special') {
			let label = activationCostTypes[activationType];

			if (activationCostDetails) {
				label += ` <i
                    class="nimble-document-card__meta-icon fa-solid fa-circle-info"
                    data-tooltip="${activationCostDetails}"
                    data-tooltip-direction="UP"
                ></i>`;
			}

			return label;
		}

		return null;
	}

	function getSpellSchoolTabs(spells) {
		const actorSpellSchools = spells.reduce((relevantSpellSchools, spell) => {
			if (spell.system.school) relevantSpellSchools.add(spell.system.school);

			return relevantSpellSchools;
		}, new Set());

		if (actorSpellSchools.size < 2) return [];

		return Object.entries(spellSchools).reduce(
			(spellSchoolTabs, [key, label]) => {
				if (actorSpellSchools.has(key)) {
					spellSchoolTabs.push({
						icon: spellSchoolIcons[key],
						name: key,
						tooltip: label,
					});
				}

				return spellSchoolTabs;
			},
			[
				{
					icon: 'fa-solid fa-grip',
					name: 'all',
					tooltip: 'All',
				},
			],
		);
	}

	function getVisibleSpells(spells, tabName) {
		if (!tabName || tabName === 'all') return groupSpellsByTier(spells);

		const spellsOfSpecifiedSchool = spells.filter(
			(spell) => spell.reactive.system.school === tabName,
		);

		const spellsByTier = groupSpellsByTier(spellsOfSpecifiedSchool);

		if (currentTab.name && currentTab.name !== 'all' && foundry.utils.isEmpty(spellsByTier)) {
			currentTab = subNavigation[0];

			if (currentTab.name && currentTab.name !== 'all') {
				return getVisibleSpells(spells, 'all');
			}
		}

		return spellsByTier;
	}

	function groupSpellsByTier(spells) {
		return spells.reduce((tiers, spell) => {
			const utilitySpell = spell.reactive.system.properties.selected.includes('utilitySpell');

			const tier = utilitySpell ? 0 : spell.reactive.system.tier;

			tiers[tier] ??= [];
			tiers[tier].push(spell);

			return tiers;
		}, {});
	}

	async function updateCurrentMana(newValue) {
		await actor.update({
			'system.resources.mana.current': newValue,
		});
	}

	async function updateMaxMana(newValue) {
		await actor.update({
			'system.resources.mana.baseMax': newValue,
		});
	}

	const {
		activationCostTypes,
		activationCostTypesPlural,
		spellSchools,
		spellSchoolIcons,
		spellTierHeadings,
	} = CONFIG.NIMBLE;

	let actor = getContext('actor');
	let sheet = getContext('application');

	// Settings
	let flags = $derived(actor.reactive.flags.nimble);
	let showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);

	// Content State
	let currentMana = $derived(actor.reactive.system.resources.mana.current);
	let baseMaxMana = $derived(actor.reactive.system.resources.mana.baseMax);
	let maxMana = $derived(actor.reactive.system.resources.mana.max);
	let searchTerm = $state('');
	let spells = $derived(filterItems(actor.reactive, ['spell'], searchTerm));
	let subNavigation = $derived(getSpellSchoolTabs(spells));
	let currentTab = $state(null);
	let visibleSpells = $derived(getVisibleSpells(spells, currentTab?.name));

	const tooltipCache = new Map();

	async function getSpellTooltip(spell) {
		const cacheKey = spell.reactive._id;
		if (tooltipCache.has(cacheKey)) {
			return tooltipCache.get(cacheKey);
		}

		const tooltip = await prepareSpellTooltip(spell.reactive);
		if (tooltip) {
			tooltipCache.set(cacheKey, tooltip);
		}
		return tooltip || '';
	}

	function handleTooltipMouseEnter(event, spell) {
		const element = event.currentTarget;
		if (!tooltipCache.has(spell.reactive._id)) {
			getSpellTooltip(spell).then((tooltip) => {
				if (tooltip) {
					element.setAttribute('data-tooltip', tooltip);
				}
			});
		}
	}
</script>

<SecondaryNavigation bind:currentTab {subNavigation} />

<header class="nimble-sheet__static nimble-sheet__static--features">
	<div class="nimble-search-wrapper">
		<SearchBar bind:searchTerm />

		<button
			class="nimble-button fa-solid fa-plus"
			data-button-variant="basic"
			type="button"
			aria-label="Create Spell"
			data-tooltip="Create Spell"
			onclick={createItem}
		></button>
	</div>
</header>

<section class="nimble-sheet__body nimble-sheet__body--player-character">
	{#each Object.entries(visibleSpells).sort(([aKey], [bKey]) => aKey - bKey) as [tier, tierSpells]}
		<div>
			<header>
				<h3 class="nimble-heading" data-heading-variant="section">
					{spellTierHeadings[tier] ?? tier}
				</h3>
			</header>

			<ul class="nimble-item-list">
				{#each sortItems(tierSpells) as spell (spell._id)}
					{@const meta = getSpellMetadata(spell)}
					{@const requiresConcentration =
						spell.reactive.system.properties.selected.includes('concentration')}
					{@const utilitySpell = spell.reactive.system.properties.selected.includes('utilitySpell')}

					<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role  -->
					<!-- svelte-ignore  a11y_click_events_have_key_events -->
					<li
						class="nimble-document-card"
						class:nimble-document-card--no-image={!showEmbeddedDocumentImages}
						class:nimble-document-card--no-meta={!meta}
						data-item-id={spell._id}
						data-tooltip={tooltipCache.get(spell.reactive._id) || ''}
						data-tooltip-class="nimble-tooltip nimble-tooltip--item"
						data-tooltip-direction="LEFT"
						onmouseenter={(event) => handleTooltipMouseEnter(event, spell)}
						draggable="true"
						role="button"
						ondragstart={(event) => sheet._onDragStart(event)}
						onclick={() => actor.activateItem(spell._id)}
					>
						{#if showEmbeddedDocumentImages}
							<img
								class="nimble-document-card__img"
								src={spell.reactive.img}
								alt={spell.reactive.name}
							/>
						{/if}

						<header class="u-semantic-only">
							<h4 class="nimble-document-card__name nimble-heading" data-heading-variant="item">
								{spell.reactive.name}

								<div class="nimble-document-card__marker-group">
									{#if !currentTab || currentTab?.name === 'all'}
										<i
											class="nimble-document-card__marker nimble-document-card__marker--spell-school {spellSchoolIcons[
												spell.reactive.system.school
											]}"
										></i>
									{/if}

									{#if requiresConcentration}
										<span class="nimble-document-card__marker"> C </span>
									{/if}

									{#if utilitySpell}
										<span class="nimble-document-card__marker" style="grid-area: miscIcons">
											U
										</span>
									{/if}
								</div>
							</h4>

							<button
								class="nimble-button"
								style="grid-area: configureButton"
								data-button-variant="icon"
								type="button"
								aria-label="Configure {spell.name}"
								onclick={(event) => configureItem(event, spell._id)}
							>
								<i class="fa-solid fa-edit"></i>
							</button>

							<button
								class="nimble-button"
								style="grid-area: deleteButton"
								data-button-variant="icon"
								type="button"
								aria-label="Delete {spell.name}"
								onclick={(event) => deleteItem(event, spell._id)}
							>
								<i class="fa-solid fa-trash"></i>
							</button>
						</header>

						{#if meta}
							<span class="nimble-document-card__meta">
								{@html meta}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</section>

<footer class="nimble-sheet__footer nimble-sheet__footer--spells">
	<header>
		<h3 class="nimble-heading u-mb-300" data-heading-variant="field">Mana</h3>
	</header>

	<div
		class="nimble-hit-points"
		style="--nimble-hp-bar-percentage: {Math.clamp(
			0,
			Math.round((currentMana / maxMana) * 100),
			100,
		)}%"
	>
		<div class="nimble-hit-points__bar">
			<div class="nimble-hit-points__values">
				<input
					class="nimble-hit-points__input nimble-hit-points__input--current-hp"
					type="number"
					value={currentMana}
					onchange={({ target }) => updateCurrentMana?.(Number(target.value))}
				/>
				/
				<input
					class="nimble-hit-points__input nimble-hit-points__input--max-hp"
					type="number"
					value={maxMana || baseMaxMana}
					onchange={({ target }) => updateMaxMana?.(Number(target.value))}
				/>
			</div>
		</div>
	</div>
</footer>

<style lang="scss">
	.nimble-items-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.nimble-item-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0.25rem 0 0 0;
		padding: 0;
		list-style: none;
	}

	.nimble-search-wrapper {
		--nimble-button-min-width: 2.25rem;

		grid-area: search;
		display: flex;
		gap: 0.375rem;
		width: 100%;
	}

	.nimble-hit-points {
		--nimble-hit-point-input-text-size: var(--nimble-sm-text);
		--nimble-hit-point-input-font-weight: 600;

		grid-area: hpBar;
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		background-color: var(--nimble-hp-bar-background);
		border: var(--nimble-hp-bar-border-thickness, 1px) solid hsl(41, 18%, 54%);
		border-radius: 4px;
		box-shadow: var(--nimble-card-box-shadow);
		font-weight: 600;
		text-shadow: 0 0 4px hsl(41, 18%, 54%);

		&__bar {
			position: relative;
			overflow: hidden;

			&::before {
				content: '';
				position: absolute;
				display: block;
				height: 100%;
				width: var(--nimble-hp-bar-percentage);
				box-shadow: 0 0 6px rgba(0, 0, 0, 0.45);
				background: linear-gradient(
					to right,
					hsl(207.03deg 47% 20%) 0%,
					hsl(212.24deg 47% 44%) 100%
				);
				z-index: 0;
				border-radius: 4px 0 0 4px;
				transition: width 0.2s ease-in-out;
			}
		}

		&__values {
			position: relative;
			display: flex;
			flex-wrap: nowrap;
			gap: 0.25rem;
			align-items: center;
			font-size: var(--nimble-hit-point-input-text-size);
			font-weight: var(--nimble-hit-point-input-font-weight);
			color: #fff;
			z-index: 5;
		}

		&__input[type] {
			font-size: var(--nimble-hit-point-input-text-size);
			text-align: center;
			text-shadow: inherit;
			color: inherit;
			border: 0;
			background: transparent;
			font-weight: var(--nimble-hit-point-input-font-weight);
			outline: none;
			box-shadow: none;

			&:active,
			&:focus,
			&:hover {
				border: 0;
				outline: none;
				box-shadow: none;
			}
		}

		&__input--current-hp[type] {
			text-align: end;
		}

		&__input--max-hp[type] {
			text-align: start;
		}
	}
</style>
