<script>
	import { getContext } from 'svelte';
	import sortItems from '../../../utils/sortItems.js';
	import localize from '../../../utils/localize.js';
	import { getPrimaryDamageFormulaFromActivationEffects } from '../../../utils/activationEffects.js';

	import SearchBar from './SearchBar.svelte';

	const { weaponProperties } = CONFIG.NIMBLE;

	let actor = getContext('actor');
	let sheet = getContext('application');

	let { onActivateItem = async () => {}, showEmbeddedDocumentImages = true } = $props();

	let searchTerm = $state('');
	let expandedDescriptions = $state(new Set());

	// ============================================================================
	// Formula Evaluation
	// ============================================================================

	function evaluateFormula(formula) {
		if (!formula) return '';

		try {
			const rollData = actor.getRollData();
			const substituted = Roll.replaceFormulaData(formula, rollData, { missing: '0' });

			const parts = substituted.split(/([+-])/);
			const simplified = [];

			for (const part of parts) {
				const trimmed = part.trim();
				if (!trimmed) continue;

				if (trimmed === '+' || trimmed === '-') {
					simplified.push(trimmed);
				} else if (/^\d*d\d+/i.test(trimmed)) {
					simplified.push(trimmed);
				} else {
					try {
						const evaluated = Roll.safeEval(trimmed);
						if (typeof evaluated === 'number' && !isNaN(evaluated)) {
							simplified.push(String(Math.floor(evaluated)));
						} else {
							simplified.push(trimmed);
						}
					} catch {
						simplified.push(trimmed);
					}
				}
			}

			let result = simplified.join(' ').replace(/\s+/g, ' ').trim();
			result = result.replace(/[+-]\s*0(?!\d)/g, '').trim();
			result = result
				.replace(/^\s*[+-]\s*/, '')
				.replace(/[+-]\s*[+-]/g, '+')
				.trim();

			return result || formula;
		} catch {
			return formula;
		}
	}

	// ============================================================================
	// Weapon Data
	// ============================================================================

	let weapons = $derived.by(() => {
		const weaponItems = actor.reactive.items.filter(
			(item) => item.type === 'object' && item.system.objectType === 'weapon',
		);

		if (!searchTerm) return weaponItems;

		const search = searchTerm.toLocaleLowerCase();
		return weaponItems.filter((item) => item.name.toLocaleLowerCase().includes(search));
	});

	let showUnarmedStrike = $derived(
		!searchTerm || 'unarmed strike'.includes(searchTerm.toLocaleLowerCase()),
	);

	let attackFeatures = $derived.by(() => {
		const features = actor.reactive.items.filter((item) => {
			if (item.type !== 'feature') return false;

			const activation = item.system?.activation;
			if (!activation) return false;

			return activation.cost?.type === 'action' && item.system?.actionType?.includes('attack');
		});

		if (!searchTerm) return features;

		const search = searchTerm.toLocaleLowerCase();
		return features.filter((item) => item.name.toLocaleLowerCase().includes(search));
	});

	function getWeaponDamage(item) {
		const effects = item.reactive?.system?.activation?.effects ?? item.system?.activation?.effects;
		const formula = getPrimaryDamageFormulaFromActivationEffects(effects);
		return evaluateFormula(formula);
	}

	function getWeaponProperties(item) {
		const props = item.reactive?.system?.properties ?? item.system?.properties ?? {};
		const selected = props.selected ?? [];

		return selected
			.map((key) => {
				const localeKey = weaponProperties[key];
				const label = localeKey ? game.i18n.localize(localeKey) : key;

				if (key === 'thrown' && props.thrownRange) {
					return localize('NIMBLE.ui.heroicActions.thrown', { distance: props.thrownRange });
				}
				if (key === 'range' && props.range?.max) {
					return localize('NIMBLE.npcSheet.range', { distance: props.range.max });
				}
				if (key === 'reach' && props.reach?.max) {
					return localize('NIMBLE.npcSheet.reach', { distance: props.reach.max });
				}

				return label;
			})
			.filter(Boolean);
	}

	function getItemDescription(item) {
		const descData = item.reactive?.system?.description ?? item.system?.description;
		if (!descData) return '';

		const desc = typeof descData === 'object' ? descData.public : descData;

		if (!desc || typeof desc !== 'string') return '';

		const stripped = desc.replace(/<[^>]*>/g, '').trim();
		return stripped ? desc : '';
	}

	function toggleDescription(itemId, event) {
		event.stopPropagation();
		const newSet = new Set(expandedDescriptions);
		if (newSet.has(itemId)) {
			newSet.delete(itemId);
		} else {
			newSet.add(itemId);
		}
		expandedDescriptions = newSet;
	}

	// ============================================================================
	// Unarmed Strike
	// ============================================================================

	const DEFAULT_UNARMED_DAMAGE = '1d4 + 1 + @abilities.strength.mod';

	function getUnarmedDamageFormula() {
		return actor.system?.unarmedDamage ?? DEFAULT_UNARMED_DAMAGE;
	}

	function hasCustomUnarmedDamage() {
		return actor.system?.unarmedDamage !== undefined;
	}

	function getUnarmedDamageDisplay() {
		if (hasCustomUnarmedDamage()) {
			return evaluateFormula(actor.system.unarmedDamage);
		}
		return evaluateFormula('1 + @abilities.strength.mod');
	}

	async function handleUnarmedStrike() {
		const { default: ItemActivationConfigDialog } = await import(
			'../../../documents/dialogs/ItemActivationConfigDialog.svelte.js'
		);
		const { DamageRoll } = await import('../../../dice/DamageRoll.js');

		const rollFormula = getUnarmedDamageFormula();
		const primaryDieAsDamage = hasCustomUnarmedDamage();

		const unarmedItem = {
			name: localize('NIMBLE.ui.heroicActions.unarmedStrike'),
			img: 'icons/skills/melee/unarmed-punch-fist.webp',
			system: {
				activation: {
					effects: [
						{
							type: 'damage',
							formula: rollFormula,
							damageType: 'bludgeoning',
							canCrit: true,
							canMiss: true,
						},
					],
				},
			},
		};

		const dialog = new ItemActivationConfigDialog(
			actor,
			unarmedItem,
			localize('NIMBLE.ui.heroicActions.unarmedStrike'),
			{ rollMode: 0 },
		);
		await dialog.render(true);
		const result = await dialog.promise;

		if (!result) return;

		const roll = new DamageRoll(rollFormula, actor.getRollData(), {
			canCrit: true,
			canMiss: true,
			rollMode: result.rollMode ?? 0,
			primaryDieValue: result.primaryDieValue ?? 0,
			primaryDieModifier: Number(result.primaryDieModifier) || 0,
			damageType: 'bludgeoning',
			primaryDieAsDamage,
		});

		await roll.evaluate();

		const rollData = roll.toJSON();

		const evaluatedEffects = [
			{
				id: 'unarmed-damage',
				type: 'damage',
				formula: rollFormula,
				damageType: 'bludgeoning',
				canCrit: true,
				canMiss: true,
				roll: rollData,
				parentNode: null,
				parentContext: null,
				on: {
					hit: [
						{
							id: 'unarmed-damage-hit',
							type: 'damageOutcome',
							parentNode: 'unarmed-damage',
							parentContext: 'hit',
						},
					],
					criticalHit: [
						{
							id: 'unarmed-damage-crit',
							type: 'damageOutcome',
							parentNode: 'unarmed-damage',
							parentContext: 'criticalHit',
						},
					],
				},
			},
		];

		const chatData = {
			author: game.user?.id,
			flavor: `${actor.name}: ${localize('NIMBLE.ui.heroicActions.unarmedStrike')}`,
			speaker: ChatMessage.getSpeaker({ actor }),
			style: CONST.CHAT_MESSAGE_STYLES.OTHER,
			sound: CONFIG.sounds.dice,
			rolls: [roll],
			system: {
				actorName: actor.name,
				actorType: actor.type,
				image: unarmedItem.img,
				permissions: 3,
				rollMode: result.rollMode ?? 0,
				name: localize('NIMBLE.ui.heroicActions.unarmedStrike'),
				description: '',
				featureType: 'feature',
				class: '',
				attackType: 'reach',
				attackDistance: 1,
				isCritical: roll.isCritical,
				isMiss: roll.isMiss,
				activation: {
					effects: evaluatedEffects,
					cost: { type: 'action', quantity: 1 },
					duration: { type: 'none', quantity: 1 },
					targets: { count: 1 },
				},
				targets: Array.from(game.user?.targets?.map((token) => token.document.uuid) ?? []),
			},
			type: 'feature',
		};

		await ChatMessage.create(chatData);
		await onActivateItem(1);
	}

	async function handleItemClick(itemId) {
		const item = actor.items.get(itemId);
		const result = await actor.activateItem(itemId);

		if (result) {
			const activationCost = item?.system?.activation?.cost;
			const costType = activationCost?.type;
			const costQuantity = activationCost?.quantity ?? 1;

			if (costType === 'action') {
				await onActivateItem(costQuantity);
			}
		}

		return result;
	}
</script>

<section class="attack-panel">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.ui.heroicActions.selectAttack')}
		</h3>
	</header>

	<div class="attack-panel__search">
		<SearchBar bind:searchTerm />
	</div>

	<div class="attack-panel__content">
		<ul class="attack-panel__list">
			{#if showUnarmedStrike}
				<li class="weapon-card">
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="weapon-card__row" role="button" tabindex="0" onclick={handleUnarmedStrike}>
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
							{getUnarmedDamageDisplay()}
						</span>
					</div>
				</li>
			{/if}

			{#each sortItems(weapons) as item (item._id)}
				{@const damage = getWeaponDamage(item)}
				{@const properties = getWeaponProperties(item)}
				{@const isExpanded = expandedDescriptions.has(item._id)}
				{@const description = getItemDescription(item)}
				<li class="weapon-card" class:weapon-card--expanded={isExpanded} data-item-id={item._id}>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="weapon-card__row"
						role="button"
						tabindex="0"
						draggable="true"
						ondragstart={(event) => sheet._onDragStart(event)}
						onclick={() => handleItemClick(item._id)}
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
								onclick={(e) => toggleDescription(item._id, e)}
								aria-label={isExpanded ? 'Collapse' : 'Expand'}
							>
								<i class="fa-solid fa-caret-{isExpanded ? 'up' : 'down'}"></i>
							</button>
						{/if}
					</div>

					{#if isExpanded && description}
						<div class="weapon-card__description">
							{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(description) then enrichedDescription}
								{@html enrichedDescription}
							{/await}
						</div>
					{/if}
				</li>
			{/each}

			{#each sortItems(attackFeatures) as item (item._id)}
				{@const damage = getWeaponDamage(item)}
				{@const isExpanded = expandedDescriptions.has(item._id)}
				{@const description = getItemDescription(item)}
				<li class="weapon-card" class:weapon-card--expanded={isExpanded} data-item-id={item._id}>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="weapon-card__row"
						role="button"
						tabindex="0"
						draggable="true"
						ondragstart={(event) => sheet._onDragStart(event)}
						onclick={() => handleItemClick(item._id)}
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
								onclick={(e) => toggleDescription(item._id, e)}
								aria-label={isExpanded ? 'Collapse' : 'Expand'}
							>
								<i class="fa-solid fa-caret-{isExpanded ? 'up' : 'down'}"></i>
							</button>
						{/if}
					</div>

					{#if isExpanded && description}
						<div class="weapon-card__description">
							{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(description) then enrichedDescription}
								{@html enrichedDescription}
							{/await}
						</div>
					{/if}
				</li>
			{/each}
		</ul>

		{#if !showUnarmedStrike && weapons.length === 0 && attackFeatures.length === 0}
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
