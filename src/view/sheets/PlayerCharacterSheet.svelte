<script>
	import { createSubscriber } from 'svelte/reactivity';
	import { setContext } from 'svelte';
	import { readable } from 'svelte/store';
	import localize from '../../utils/localize.js';
	import {
		getInitiativeCombatManaRules,
		primeActorCombatManaSourceRules,
	} from '../../utils/combatManaRules.js';
	import PrimaryNavigation from '../components/PrimaryNavigation.svelte';
	import updateDocumentImage from '../handlers/updateDocumentImage.js';
	import HitPointBar from './components/HitPointBar.svelte';
	import HitDiceBar from './components/HitDiceBar.svelte';
	import ManaBar from './components/ManaBar.svelte';
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

	function hasInitiativeCombatManaRule(character) {
		const rules = getInitiativeCombatManaRules(character);
		return rules.length > 0;
	}

	function getActiveCombatForCurrentScene() {
		const sceneId = canvas?.scene?.id;
		if (!sceneId) return null;

		const activeCombat = game.combat;
		if (activeCombat?.active && activeCombat.scene?.id === sceneId) {
			return activeCombat;
		}

		const activeByScene = game.combats?.contents?.find(
			(combat) => combat?.active && combat.scene?.id === sceneId,
		);
		if (activeByScene) return activeByScene;

		const viewedCombat = game.combats?.viewed ?? null;
		if (viewedCombat?.active && viewedCombat.scene?.id === sceneId) {
			return viewedCombat;
		}

		return null;
	}

	function hasRolledInitiativeInActiveCombat(character) {
		const combat = getActiveCombatForCurrentScene();
		if (!combat?.started) return false;

		const sceneId = canvas?.scene?.id;
		if (sceneId && combat.scene?.id !== sceneId) return false;

		const combatant = combat.combatants.find((entry) => entry.actorId === character.id);
		if (!combatant) return false;

		return combatant.initiative !== null;
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

	function updateCurrentMana(newValue) {
		actor.update({
			'system.resources.mana.current': newValue,
		});
	}

	function updateMaxMana(newValue) {
		const manaData = actor.reactive.system.resources.mana;
		const baseMax = manaData.baseMax ?? 0;
		const max = manaData.max || baseMax;
		const formulaBonus = max - baseMax;
		const adjustedBaseMax = Math.max(0, newValue - formulaBonus);

		actor.update({
			'system.resources.mana.baseMax': adjustedBaseMax,
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

	async function toggleEditingEnabled() {
		await actor.setFlag('nimble', 'editingEnabled', !editingEnabled);
	}

	let { actor, sheet } = $props();
	let combatManaRulesPrimeVersion = $state(0);
	let lastCombatManaPrimeActorId = $state(null);

	$effect(() => {
		const actorId = actor?.id ?? null;
		if (!actorId) return;
		if (lastCombatManaPrimeActorId === actorId) return;

		lastCombatManaPrimeActorId = actorId;
		void primeActorCombatManaSourceRules(actor).then(() => {
			combatManaRulesPrimeVersion += 1;
		});
	});

	const subscribeCombatState = createSubscriber((update) => {
		const hookNames = [
			'combatStart',
			'createCombat',
			'updateCombat',
			'deleteCombat',
			'createCombatant',
			'updateCombatant',
			'deleteCombatant',
			'canvasInit',
			'canvasReady',
		];
		const hookIds = hookNames.map((hookName) => ({
			hookId: Hooks.on(hookName, () => update()),
			hookName,
		}));

		return () => {
			for (const { hookName, hookId } of hookIds) {
				Hooks.off(hookName, hookId);
			}
		};
	});

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
	let mana = $derived(actor.reactive.system.resources.mana);
	let hasInitiativeCombatMana = $derived.by(() => {
		combatManaRulesPrimeVersion;
		return hasInitiativeCombatManaRule(actor);
	});
	let combatManaVisible = $derived.by(() => {
		subscribeCombatState();
		return hasInitiativeCombatMana && hasRolledInitiativeInActiveCombat(actor);
	});
	let hasMana = $derived.by(() => {
		subscribeCombatState();

		const maxMana = mana.max || mana.baseMax || 0;
		const classHasManaFormula = actor.reactive.items.some(
			(item) => item.type === 'class' && item.system?.mana?.formula?.length,
		);

		if (hasInitiativeCombatMana) {
			return combatManaVisible && maxMana > 0;
		}

		if ((mana.max ?? 0) > 0 || (mana.baseMax ?? 0) > 0) return true;
		return classHasManaFormula;
	});

	// Flags
	let flags = $derived(actor.reactive.flags.nimble);
	let actorImageXOffset = $derived(flags?.actorImageXOffset ?? 0);
	let actorImageYOffset = $derived(flags?.actorImageYOffset ?? 0);
	let actorImageScale = $derived(flags?.actorImageScale ?? 100);
	let editingEnabled = $derived(flags?.editingEnabled ?? true);
	const editingEnabledStore = readable(false, (set) => {
		$effect(() => set(editingEnabled));
		return () => {};
	});

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
	setContext('editingEnabled', editingEnabledStore);
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
			disabled={!editingEnabled}
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
				disabled={!editingEnabled}
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
			disableMaxHPEdit={!editingEnabled}
		/>

		<h3 class="nimble-heading nimble-heading--hit-dice">
			{CONFIG.NIMBLE.hitDice.heading}
			<i class="fa-solid fa-heart-circle-plus"></i>
			<button
				class="nimble-button"
				data-button-variant="icon"
				type="button"
				aria-label={CONFIG.NIMBLE.hitDice.configureHitDice}
				data-tooltip={CONFIG.NIMBLE.hitDice.configureHitDice}
				onclick={() => actor.configureHitDice()}
				disabled={!editingEnabled}
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
			disableControls={!editingEnabled}
		/>

		{#if hasMana}
			<h3 class="nimble-heading nimble-heading--mana">
				Mana
				<i class="fa-solid fa-sparkles"></i>
				<button
					class="nimble-button"
					data-button-variant="icon"
					type="button"
					aria-label={CONFIG.NIMBLE.manaConfig.configureMana}
					data-tooltip={CONFIG.NIMBLE.manaConfig.configureMana}
					onclick={() => actor.configureMana()}
					disabled={!editingEnabled}
				>
					<i class="fa-solid fa-edit"></i>
				</button>
			</h3>

			<ManaBar
				currentMana={mana.current}
				maxMana={mana.max || mana.baseMax}
				{updateCurrentMana}
				{updateMaxMana}
				disableMaxManaEdit={true}
			/>
		{/if}
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
			disabled={!editingEnabled}
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
					disabled={!editingEnabled}
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
		class:nimble-edit-toggle--enabled={editingEnabled}
		type="button"
		aria-pressed={editingEnabled}
		aria-label={editingEnabled ? 'Disable editing' : 'Enable editing'}
		data-tooltip={editingEnabled ? 'Editing Enabled' : 'Editing Locked'}
		onclick={toggleEditingEnabled}
	>
		<span class="nimble-edit-toggle__track">
			<span class="nimble-edit-toggle__thumb">
				<i class="fa-solid {editingEnabled ? 'fa-pen' : 'fa-lock'}"></i>
			</span>
		</span>
	</button>
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
	.nimble-sheet__header {
		position: relative;
	}

	.nimble-edit-toggle__track {
		position: relative;
		width: 2.1rem;
		height: 1rem;
		border-radius: 999px;
		background: var(--nimble-overhang-button-text-color);
		border: 1px solid var(--nimble-overhang-button-text-color);
		display: flex;
		align-items: center;
	}

	.nimble-edit-toggle__thumb {
		position: absolute;
		left: 0.1rem;
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		background: var(--nimble-overhang-button-text-color);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: hsl(215, 30%, 12%);
		font-size: 0.45rem;
		transform: translateX(0);
		transition:
			transform 0.2s ease-in-out,
			background-color 0.2s ease-in-out;
		box-shadow: 0 0 4px rgba(0, 0, 0, 0.45);
	}

	.nimble-edit-toggle--enabled .nimble-edit-toggle__thumb {
		transform: translateX(1.05rem);
	}

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
				'hpBar hitDiceBar'
				'manaHeading manaHeading'
				'manaBar manaBar';
			grid-gap: 0 0.125rem;
			margin-block-start: 0.25rem;
			margin-inline: 0.25rem;
		}
	}

	.nimble-wounds-indicator {
		// Always use dark mode text color for icon stroke (light cream color)
		--stroke-color: hsl(36, 53%, 80%);

		display: inline-flex;
		align-items: center;
		gap: 0.1875rem;
		margin-inline-start: 0.25rem;
		cursor: default;

		&__count {
			font-weight: 700;
			font-size: var(--nimble-sm-text);
			line-height: 1;
			// Use same color as heading for consistency
			color: var(--nimble-dark-text-color);
		}

		i {
			font-size: inherit;
			color: #b01b19;
			// Firefox fallback: text-shadow simulates stroke
			text-shadow:
				-0.5px -0.5px 0 var(--stroke-color),
				0.5px -0.5px 0 var(--stroke-color),
				-0.5px 0.5px 0 var(--stroke-color),
				0.5px 0.5px 0 var(--stroke-color);
			-webkit-text-stroke: 0.5px var(--stroke-color);
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

	.nimble-heading--mana {
		grid-area: manaHeading;
		margin-block-start: 0.25rem;
	}
</style>
