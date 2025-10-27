<script>
import { setContext } from 'svelte';
import localize from '../../utils/localize.js';
import updateDocumentImage from '../handlers/updateDocumentImage.js';

import HitPointBar from './components/HitPointBar.svelte';
import NPCNotesTab from './pages/NPCNotesTab.svelte';
import NPCSettingsTab from './pages/NPCSettingsTab.svelte';
import PrimaryNavigation from '../components/PrimaryNavigation.svelte';
import NPCCoreTab from './pages/NPCCoreTab.svelte';

function getHitPointPercentage(currentHP, maxHP) {
	return Math.clamp(0, Math.round((currentHP / maxHP) * 100), 100);
}

function prepareMonsterMetadata() {
	if (actor.reactive.type === 'soloMonster') {
		return `Level ${actor.reactive.system.details.level ?? 1} Solo ${actor.reactive.system.attributes.sizeCategory} ${actor.reactive.system.details.creatureType}`;
	}

	if (actor.reactive.type === 'minion') {
		return `Level ${actor.reactive.system.details.level ?? 1} ${actor.reactive.system.attributes.sizeCategory} ${actor.reactive.system.details.creatureType} Minion}`;
	}

	if (actor.reactive.system.details.isFlunky) {
		return `Level ${actor.reactive.system.details.level ?? 1} ${actor.reactive.system.attributes.sizeCategory} ${actor.reactive.system.details.creatureType} Flunky}`;
	}

	return `Level ${actor.reactive.system.details.level ?? 1} ${actor.reactive.system.attributes.sizeCategory} ${actor.reactive.system.details.creatureType}}`;
}

function updateCurrentHP(newValue) {
	actor.update({ 'system.attributes.hp.value': newValue });
}

function updateMaxHP(newValue) {
	actor.update({ 'system.attributes.hp.max': newValue });
}

function updateTempHP(newValue) {
	actor.update({ 'system.attributes.hp.temp': newValue });
}

let { actor } = $props();

const { npcArmorTypes } = CONFIG.NIMBLE;

let isBloodied = $derived.by(() => {
	if (actor.type === 'minion') return false;

	return (
		getHitPointPercentage(
			actor.reactive.system.attributes.hp?.value,
			actor.reactive.system.attributes.hp?.max,
		) <= 50
	);
});

const navigation = [
	{
		component: NPCCoreTab,
		icon: 'fa-solid fa-home',
		tooltip: 'Core',
		name: 'core',
	},
	{
		component: NPCNotesTab,
		icon: 'fa-solid fa-scroll',
		tooltip: 'Notes',
		name: 'notes',
	},
	{
		component: NPCSettingsTab,
		icon: 'fa-solid fa-cog',
		tooltip: 'Settings',
		name: 'settings',
	},
];

let currentTab = $state(navigation[0]);
let monsterMetadata = $derived(prepareMonsterMetadata() ?? '');

// Flags
let flags = $derived(actor.reactive.flags.nimble);
let actorImageXOffset = $derived(flags?.actorImageXOffset ?? 0);
let actorImageYOffset = $derived(flags?.actorImageYOffset ?? 0);
let actorImageScale = $derived(flags?.actorImageScale ?? 100);

setContext('actor', actor);
</script>

<header class="nimble-sheet__header">
    <section class="nimble-icon nimble-icon--actor">
        <button
            class="nimble-icon__button nimble-icon__button--actor"
            data-tooltip="NIMBLE.prompts.changeActorImage"
            type="button"
            aria-label="Change Actor Image"
            onclick={(event) => updateDocumentImage(actor, { shiftKey: event.shiftKey })}
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
    </section>

    {#if actor.type !== "minion"}
        <section class="nimble-monster-sheet-section nimble-monster-sheet-section--defense">
            <h3 class="nimble-heading nimble-heading--hp">
                Hit Points

                {#if isBloodied}
                    <i class="fa-solid fa-heart-crack"></i>
                {:else}
                    <i class="fa-solid fa-heart"></i>
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
            ></HitPointBar>
        </section>
    {/if}

    <div class="nimble-monster-header">
        <input
            class="nimble-heading"
            data-heading-variant="document"
            type="text"
            value={actor.reactive.name}
            autocomplete="off"
            spellcheck="false"
            onchange={({ target }) => actor.update({ name: target.value })}
        />

        <h4 class="nimble-monster-meta">
            {monsterMetadata}

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
    </div>
</header>

<PrimaryNavigation bind:currentTab {navigation} />

<currentTab.component />

<style lang="scss">
    .nimble-monster-header {
        display: flex;
        flex-direction: column;
        justify-content: center;
        flex-grow: 1;
        gap: 0.125rem;
        padding: 0.75rem 0.5rem 0.375rem 0.5rem;
    }

    .nimble-monster-meta {
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
            --nimble-temp-hp-field-width: 10ch;

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
</style>
