<script>
import { setContext } from 'svelte';
import localize from '../../utils/localize.js';
import updateDocumentImage from '../handlers/updateDocumentImage.js';

import HitPointBar from './components/HitPointBar.svelte';
import PlayerCharacterBioTab from './pages/PlayerCharacterBioTab.svelte';
import PlayerCharacterCoreTab from './pages/PlayerCharacterCoreTab.svelte';
import PlayerCharacterFeaturesTab from './pages/PlayerCharacterFeaturesTab.svelte';
import PlayerCharacterInventoryTab from './pages/PlayerCharacterInventoryTab.svelte';
import PlayerCharacterSettingsTab from './pages/PlayerCharacterSettingsTab.svelte';
import PrimaryNavigation from '../components/PrimaryNavigation.svelte';
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

let subclassItem = $derived(actor.reactive.items.find((item) => item.type === 'subclass') ?? null);

let ancestryItem = $derived(actor.reactive.items.find((item) => item.type === 'ancestry') ?? null);

let wounds = $derived(actor.reactive.system.attributes.wounds);
let sizeCategory = $derived(actor.reactive.system.attributes.sizeCategory);

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

setContext('actor', actor);
setContext('document', actor);
setContext('application', sheet);
</script>

<header class="nimble-sheet__header">
    <div class="nimble-icon nimble-icon--actor">
        <ul
            class="nimble-wounds-list"
            class:nimble-wounds-list--centered={wounds.max > 9 &&
                wounds.max % 6 >= 3}
        >
            {#each { length: wounds.max }, i}
                <li class="nimble-wounds-list__item">
                    <button
                        class="nimble-wounds-list__button"
                        class:nimble-wounds-list__button--active={wounds.value >
                            i}
                        type="button"
                        data-tooltip="Toggle Wound"
                        data-tooltip-direction="LEFT"
                        aria-label="Toggle wound"
                        onclick={() => toggleWounds(i + 1)}
                    >
                        <i class="nimble-wounds-list__icon fa-solid fa-droplet"
                        ></i>
                    </button>
                </li>
            {/each}
        </ul>

        <button
            class="nimble-icon__button nimble-icon__button--actor"
            aria-label={localize("NIMBLE.prompts.changeActorImage")}
            data-tooltip="NIMBLE.prompts.changeActorImage"
            onclick={(event) =>
                updateDocumentImage(actor, { shiftKey: event.shiftKey })}
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

    <section
        class="nimble-monster-sheet-section nimble-monster-sheet-section--defense"
    >
        <h3 class="nimble-heading nimble-heading--hp">
            Hit Points

            {#if isBloodied}
                <i class="fa-solid fa-heart-crack"></i>
            {:else}
                <i class="fa-solid fa-heart"></i>
            {/if}

            {#if wounds.value === 1}
                <span class="nimble-wounds-label">({wounds.value} Wound)</span>
            {:else if wounds.value > 0}
                <span class="nimble-wounds-label">({wounds.value} Wounds)</span>
            {/if}
        </h3>

        <HitPointBar
            currentHP={actor.reactive.system.attributes.hp.value}
            maxHP={actor.reactive.system.attributes.hp.max}
            tempHP={actor.reactive.system.attributes.hp.temp}
            {isBloodied}
            {updateCurrentHP}
            {updateMaxHP}
            {updateTempHP}
        />

        <h3 class="nimble-heading nimble-heading--armor">
            Hit Dice
            <i class="fa-solid fa-heart-circle-plus"></i>
        </h3>

        <div class="nimble-monster-span nimble-monster-input--armor">
            <span>{actor.HitDiceManager.value}</span>
            /
            <span>{actor.HitDiceManager.max}</span>
        </div>
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
            <h4 class="nimble-monster-meta">
                {metaData}
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
        aria-label={localize("NIMBLE.prompts.levelUp")}
        data-tooltip={localize("NIMBLE.prompts.levelUp")}
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
        onclick={() => actor.revertLastLevelUp()}
        disabled={actor.reactive.system.levelUpHistory.length === 0}
        type="button"
    >
        <i class="fa-solid fa-undo"></i>
    </button>

    <button
        class="nimble-button"
        data-button-variant="overhang"
        aria-label={localize("NIMBLE.prompts.fieldRest")}
        data-tooltip={localize("NIMBLE.prompts.fieldRest")}
        onclick={() => actor.triggerRest({ restType: "field" })}
        type="button"
    >
        <i class="fa-regular fa-hourglass-half"></i>
    </button>

    <button
        class="nimble-button"
        data-button-variant="overhang"
        aria-label={localize("NIMBLE.prompts.safeRest")}
        data-tooltip={localize("NIMBLE.prompts.safeRest")}
        onclick={() => actor.triggerRest({ restType: "safe" })}
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

    .nimble-monster-meta {
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

    .nimble-monster-sheet-section {
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
            grid-template-columns: 1fr max-content;
            grid-template-areas:
                "hpHeading armorHeading"
                "hpBar armorInput";
            grid-gap: 0 0.125rem;
            margin-block-start: -2.25rem;
            margin-inline: 0.25rem;
        }
    }

    .nimble-monster-input--armor {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        width: 12ch;
        font-size: var(--nimble-sm-text);
        font-weight: 600;
        text-align: center;
        text-shadow: 0 0 4px hsl(41, 18%, 54%);
        text-transform: uppercase;
        line-height: 1;
        color: #fff;
        background: transparent;
        background-color: var(--nimble-hp-bar-background);
        border: 1px solid hsl(41, 18%, 54%);
        border-radius: 4px;
        box-shadow: var(--nimble-card-box-shadow);

        &:active,
        &:focus,
        &:hover {
            border: 1px solid hsl(41, 18%, 54%);
            outline: none;
            box-shadow: var(--nimble-card-box-shadow);
        }
    }

    .nimble-wounds-label {
        margin-inline-start: 0.25rem;
    }
</style>
