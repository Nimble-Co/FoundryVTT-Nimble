<script>
	import { setContext } from 'svelte';
	import localize from '../../utils/localize.js';
	import PrimaryNavigation from '../components/PrimaryNavigation.svelte';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';
	import HitPointBar from './components/HitPointBar.svelte';
	import HitDiceBar from './components/HitDiceBar.svelte';
	import { incrementDieSize } from '../../managers/HitDiceManager.js';
	import PlayerCharacterBioTab from './pages/PlayerCharacterBioTab.svelte';
	import PlayerCharacterCoreTab from './pages/PlayerCharacterCoreTab.svelte';
	import PlayerCharacterFeaturesTab from './pages/PlayerCharacterFeaturesTab.svelte';
	import PlayerCharacterInventoryTab from './pages/PlayerCharacterInventoryTab.svelte';
	import PlayerCharacterSettingsTab from './pages/PlayerCharacterSettingsTab.svelte';
	import PlayerCharacterSpellsTab from './pages/PlayerCharacterSpellsTab.svelte';

	function getHitPointPercentage(currentHP, maxHP) {
		return Math.clamp(0, Math.round((currentHP / maxHP) * 100), 100);
	}

	function prepareCharacterMetadata(characterClass, subclass, ancestry, sizeCategory) {
		const origins = [];

		if (ancestry) {
			origins.push(`${ancestry.name} (${sizeCategories[sizeCategory] ?? sizeCategory})`);
		}

		if (characterClass) {
			if (subclass) {
				origins.push(
					`${characterClass.name} (${subclass.name}, ${characterClass.system.classLevel})`,
				);
			} else {
				origins.push(`${characterClass.name} (${characterClass.system.classLevel})`);
			}
		}

		return origins.filter(Boolean).join(' ⟡ ');
	}

	function toggleWounds(woundLevel) {
		let newWoundsValue = woundLevel;

		if (woundLevel <= wounds.value) newWoundsValue = woundLevel - 1;

		actor.update({
			'system.attributes.wounds.value': newWoundsValue,
		});
	}

	function updateCurrentHP(newValue) {
		actor.update({
			'system.attributes.hp.value': newValue,
		});
	}

	function updateMaxHP(newValue) {
		actor.update({
			'system.attributes.hp.max': newValue,
		});
	}

	function updateTempHP(newValue) {
		actor.update({
			'system.attributes.hp.temp': newValue,
		});
	}

	async function updateCurrentHitDice(newValue) {
		await actor.updateCurrentHitDice(newValue);
	}

	async function rollHitDice() {
		await actor.rollHitDice();
	}

	async function editCurrentHitDice() {
		await actor.editCurrentHitDice();
	}

	let { actor, sheet } = $props();

	const navigation = $state([
		{
			component: PlayerCharacterCoreTab,
			icon: 'fa-solid fa-home',
			tooltip: 'Core',
			name: 'core',
		},
		{
			component: PlayerCharacterInventoryTab,
			icon: 'fa-solid fa-box-open',
			tooltip: 'Inventory',
			name: 'inventory',
		},
		{
			component: PlayerCharacterFeaturesTab,
			icon: 'fa-solid fa-table-list',
			tooltip: 'Features',
			name: 'features',
		},
		{
			component: PlayerCharacterSpellsTab,
			icon: 'fa-solid fa-wand-sparkles',
			tooltip: 'Spells',
			name: 'spells',
		},
		{
			component: PlayerCharacterBioTab,
			icon: 'fa-solid fa-file-lines',
			tooltip: 'Bio',
			name: 'bio',
		},
		{
			component: PlayerCharacterSettingsTab,
			icon: 'fa-solid fa-cog',
			tooltip: 'Settings',
			name: 'settings',
		},
	]);

	const { sizeCategories } = CONFIG.NIMBLE;

	let currentTab = $state(navigation[0]);

	let isBloodied = $derived.by(
		() =>
			getHitPointPercentage(
				actor.reactive.system.attributes.hp.value,
				actor.reactive.system.attributes.hp.max,
			) <= 50,
	);

	let classItem = $derived(actor.reactive.items.find((item) => item.type === 'class') ?? null);
	let wounds = $derived(actor.reactive.system.attributes.wounds);

	// Flags
	let flags = $derived(actor.reactive.flags.nimble);
	let actorImageXOffset = $derived(flags?.actorImageXOffset ?? 0);
	let actorImageYOffset = $derived(flags?.actorImageYOffset ?? 0);
	let actorImageScale = $derived(flags?.actorImageScale ?? 100);

	let metaData = $derived.by(() => {
		const c = actor.reactive.items.find((i) => i.type === 'class') ?? null;
		const sub = actor.reactive.items.find((i) => i.type === 'subclass') ?? null;
		const anc = actor.reactive.items.find((i) => i.type === 'ancestry') ?? null;
		const size = actor.reactive.system.attributes.sizeCategory;
		return prepareCharacterMetadata(c, sub, anc, size);
	});

	// Reactive hit dice computations
	let hitDiceData = $derived.by(() => {
		const hitDiceAttr = actor.reactive.system.attributes.hitDice;
		const bonusHitDice = actor.reactive.system.attributes.bonusHitDice ?? [];
		const classes = actor.reactive.items.filter((i) => i.type === 'class');

		// Get hit dice size bonus from rules (e.g., Oozeling's Odd Constitution)
		const hitDiceSizeBonus = actor.reactive.system.attributes.hitDiceSizeBonus ?? 0;

		// Build bySize from classes and bonus hit dice
		const bySize = {};

		// Add from classes (apply hitDiceSizeBonus to get effective size)
		for (const cls of classes) {
			const baseSize = cls.system.hitDieSize;
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			const classLevel = cls.system.classLevel;
			bySize[size] ??= { current: 0, total: 0 };
			bySize[size].total += classLevel;
			bySize[size].current = hitDiceAttr[size]?.current ?? 0;
		}

		// Get effective class sizes (after applying bonus) for later checks
		const effectiveClassSizes = classes.map((cls) =>
			incrementDieSize(cls.system.hitDieSize, hitDiceSizeBonus),
		);

		// Add from bonusHitDice array (apply hitDiceSizeBonus to increment)
		for (const entry of bonusHitDice) {
			const size = incrementDieSize(entry.size, hitDiceSizeBonus);
			bySize[size] ??= { current: hitDiceAttr[size]?.current ?? 0, total: 0 };
			bySize[size].total += entry.value;
			// Get current from hitDice record if not already set
			if (!effectiveClassSizes.includes(size)) {
				bySize[size].current = hitDiceAttr[size]?.current ?? 0;
			}
		}

		// Get effective bonus array sizes (after increment) for later checks
		const effectiveBonusArraySizes = bonusHitDice.map((entry) =>
			incrementDieSize(entry.size, hitDiceSizeBonus),
		);

		// Add from rule-based bonuses (hitDice[size].bonus)
		// Rule bonuses add to total; current comes from stored value (restored on rest)
		// Apply hitDiceSizeBonus to increment these dice as well
		for (const [sizeStr, hitDieData] of Object.entries(hitDiceAttr ?? {})) {
			const baseSize = Number(sizeStr);
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			const bonus = hitDieData?.bonus ?? 0;
			if (bonus > 0) {
				bySize[size] ??= { current: 0, total: 0 };
				bySize[size].total += bonus;

				// If this size wasn't from a class or bonusHitDice array (after increment), get stored current
				const fromClass = effectiveClassSizes.includes(size);
				const fromBonusArray = effectiveBonusArraySizes.includes(size);
				if (!fromClass && !fromBonusArray) {
					bySize[size].current = hitDiceAttr[size]?.current ?? 0;
				}
			}
		}

		// Calculate totals
		let value = 0;
		let max = 0;
		for (const data of Object.values(bySize)) {
			value += data.current;
			max += data.total;
		}

		return { bySize, value, max };
	});

	setContext('actor', actor);
	setContext('document', actor);
	setContext('application', sheet);
</script>

<header class="nimble-sheet__header">
	<div class="nimble-icon nimble-icon--actor">
		<ul
			class="nimble-wounds-list"
			class:nimble-wounds-list--centered={wounds.max > 9 && wounds.max % 6 >= 3}
		>
			{#each { length: wounds.max }, i}
				<li class="nimble-wounds-list__item">
					<button
						class="nimble-wounds-list__button"
						class:nimble-wounds-list__button--active={wounds.value > i}
						type="button"
						data-tooltip="Toggle Wound"
						data-tooltip-direction="LEFT"
						aria-label="Toggle wound"
						onclick={() => toggleWounds(i + 1)}
					>
						<i class="nimble-wounds-list__icon fa-solid fa-droplet"></i>
					</button>
				</li>
			{/each}
		</ul>

		<button
			class="nimble-icon__button nimble-icon__button--actor"
			aria-label={localize('NIMBLE.prompts.changeActorImage')}
			data-tooltip="NIMBLE.prompts.changeActorImage"
			onclick={(event) => updateDocumentImage(actor, { shiftKey: event.shiftKey })}
			type="button"
		>
			<img
				class="nimble-icon__image nimble-icon__image--actor"
				src={actor.reactive.img}
				alt={actor.reactive.name}
				style="
                    --nimble-actor-image-x-offset: {actorImageXOffset}px;
                    --nimble-actor-image-y-offset: {actorImageYOffset}px;
                    --nimble-actor-image-scale: {actorImageScale}%;
                "
			/>
		</button>
	</div>

	<section class="nimble-character-sheet-section nimble-character-sheet-section--defense">
		<h3 class="nimble-heading nimble-heading--hp">
			Hit Points

			<span data-tooltip={isBloodied ? 'Bloodied' : null}>
				{#if isBloodied}
					<i class="fa-solid fa-heart-crack"></i>
				{:else}
					<i class="fa-solid fa-heart"></i>
				{/if}
			</span>

			{#if wounds.value > 0}
				<span
					class="nimble-wounds-indicator"
					data-tooltip="{wounds.value} {wounds.value === 1 ? 'Wound' : 'Wounds'}"
				>
					<i class="nimble-wounds-list__icon fa-solid fa-droplet"></i>
					<span class="nimble-wounds-indicator__count">{wounds.value}</span>
				</span>
			{/if}
			<button
				class="nimble-button"
				data-button-variant="icon"
				type="button"
				aria-label="Configure Hit Points"
				data-tooltip="Configure Hit Points"
				onclick={() => actor.configureHitPoints()}
			>
				<i class="fa-solid fa-edit"></i>
			</button>
		</h3>

		<HitPointBar
			currentHP={actor.reactive.system.attributes.hp.value}
			maxHP={actor.reactive.system.attributes.hp.max}
			tempHP={actor.reactive.system.attributes.hp.temp}
			{isBloodied}
			{updateCurrentHP}
			{updateMaxHP}
			{updateTempHP}
			disableMaxHPEdit={true}
		/>

		<h3 class="nimble-heading nimble-heading--hit-dice">
			Hit Dice
			<i class="fa-solid fa-heart-circle-plus"></i>
			<button
				class="nimble-button"
				data-button-variant="icon"
				type="button"
				aria-label="Configure Hit Dice"
				data-tooltip="Configure Hit Dice"
				onclick={() => actor.configureHitDice()}
			>
				<i class="fa-solid fa-edit"></i>
			</button>
		</h3>

		<HitDiceBar
			value={hitDiceData.value}
			max={hitDiceData.max}
			bySize={hitDiceData.bySize}
			{updateCurrentHitDice}
			{editCurrentHitDice}
			{rollHitDice}
		/>
	</section>

	<div class="nimble-player-character-header">
		<input
			class="nimble-heading"
			data-heading-variant="document"
			type="text"
			value={actor.reactive.name}
			autocomplete="off"
			spellcheck="false"
			onchange={({ target }) => actor.update({ name: target.value })}
		/>

		{#if metaData}
			<h4 class="nimble-character-meta">
				{metaData}

				<button
					class="nimble-button"
					type="button"
					data-button-variant="icon"
					aria-label="Edit"
					data-tooltip="Edit"
					onclick={() => actor.editMetadata()}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			</h4>
		{/if}
	</div>
</header>

<PrimaryNavigation bind:currentTab {navigation} condenseNavigation={true} />

<currentTab.component />

<section class="nimble-sheet__sidebar">
	<button
		class="nimble-button"
		data-button-variant="overhang"
		aria-label={localize('NIMBLE.prompts.levelUp')}
		data-tooltip={localize('NIMBLE.prompts.levelUp')}
		onclick={() => actor.triggerLevelUp()}
		disabled={!classItem || classItem?.system?.classLevel >= 20}
		type="button"
	>
		<i class="fa-solid fa-arrow-up-right-dots"></i>
	</button>

	<button
		class="nimble-button"
		data-button-variant="overhang"
		aria-label="Revert Last Level Up"
		data-tooltip="Revert Last Level Up"
		onclick={() => actor.triggerLevelDown()}
		disabled={actor.reactive.system.levelUpHistory.length === 0}
		type="button"
	>
		<i class="fa-solid fa-undo"></i>
	</button>

	<button
		class="nimble-button"
		data-button-variant="overhang"
		aria-label={localize('NIMBLE.prompts.fieldRest')}
		data-tooltip={localize('NIMBLE.prompts.fieldRest')}
		onclick={() => actor.triggerRest({ restType: 'field' })}
		type="button"
	>
		<i class="fa-regular fa-hourglass-half"></i>
	</button>

	<button
		class="nimble-button"
		data-button-variant="overhang"
		aria-label={localize('NIMBLE.prompts.safeRest')}
		data-tooltip={localize('NIMBLE.prompts.safeRest')}
		onclick={() => actor.triggerRest({ restType: 'safe' })}
		type="button"
	>
		<i class="fa-solid fa-moon"></i>
	</button>
</section>

<style lang="scss">
	.nimble-player-character-header {
		display: flex;
		flex-direction: column;
		justify-content: center;
		flex-grow: 1;
		gap: 0.125rem;
		padding: 0.75rem 0.5rem 0.375rem 0.5rem;
	}

	.nimble-character-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		font-size: var(--nimble-sm-text);
		font-weight: 500;
		font-synthesis: none;
		border: 0;
		color: var(--nimble-medium-text-color);
		text-shadow: none;

		&:hover {
			--nimble-edit-button-opacity: 1;
		}
	}

	.nimble-character-meta {
		--nimble-button-font-size: var(--nimble-sm-text);
		--nimble-button-opacity: 0;
		--nimble-button-padding: 0;
		--nimble-button-icon-y-nudge: -1px;

		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		font-size: var(--nimble-sm-text);
		font-weight: 500;
		font-synthesis: none;
		border: 0;
		color: var(--nimble-medium-text-color);
		text-shadow: none;

		&:hover {
			--nimble-button-opacity: 1;
		}
	}

	.nimble-character-sheet-section {
		padding: 0.5rem;

		&:not(:last-of-type) {
			border-bottom: 1px solid hsl(41, 18%, 54%);
		}

		&--defense,
		&--defense:not(:last-of-type) {
			border: none;
			padding: 0;
		}

		&--defense {
			position: relative;
			display: grid;
			// Keep the hit dice column compact so HP stays the primary bar.
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'hpHeading hitDiceHeading'
				'hpBar hitDiceBar';
			grid-gap: 0 0.125rem;
			margin-block-start: -2.25rem;
			margin-inline: 0.25rem;
		}
	}

	.nimble-wounds-indicator {
		display: inline-flex;
		align-items: center;
		gap: 0.1875rem;
		margin-inline-start: 0.25rem;
		cursor: default;

		&__count {
			font-weight: 700;
			font-size: var(--nimble-sm-text);
			line-height: 1;
			color: #b01b19;
			-webkit-text-stroke: 0.5px #fff;
			filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
		}

		i {
			// Match the size of the heart icon in the heading
			font-size: inherit;
			color: #b01b19;
			-webkit-text-stroke: 1px #fff;
			filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
		}
	}

	.nimble-heading--hp {
		grid-area: hpHeading;
		// Prevent wounds label from expanding the heading beyond available space
		overflow: hidden;
		min-width: 0;

		.nimble-button {
			opacity: 0;
			transition: opacity 0.2s ease-in-out;
		}

		&:hover .nimble-button {
			opacity: 1;
		}
	}

	.nimble-heading--hit-dice {
		grid-area: hitDiceHeading;

		.nimble-button {
			opacity: 0;
			transition: opacity 0.2s ease-in-out;
		}

		&:hover .nimble-button {
			opacity: 1;
		}
	}
</style>
