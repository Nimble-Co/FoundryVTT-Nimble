<script>
import { getContext, onDestroy } from 'svelte';

import ArmorClass from '../components/ArmorClass.svelte';
import Editor from '../components/Editor.svelte';
import MonsterFeature from '../components/MonsterFeature.svelte';
import SavingThrows from '../components/SavingThrows.svelte';
import sortItems from '../../../utils/sortItems.js';

import SearchBar from '../components/SearchBar.svelte';
import prepareMonsterFeatureTooltip from '../../dataPreparationHelpers/documentTooltips/prepareMonsterFeatureTooltip.js';

async function configureItem(event, id) {
	event.stopPropagation();

	await actor.configureItem(id);
}

async function createItem(event) {
	event.stopPropagation();

	await actor.createItem({ name: 'New Feature', type: 'monsterFeature' });
}

async function deleteItem(event, id) {
	event.stopPropagation();

	await actor.deleteItem(id);
}

function groupItemsByType(items) {
	return items.reduce((categories, item) => {
		const itemType = mapMonsterFeatureToType(item);
		categories[itemType] ??= [];
		categories[itemType].push(item);
		return categories;
	}, {});
}

function sortItemCategories([categoryA], [categoryB]) {
	return validTypes.indexOf(categoryA) - validTypes.indexOf(categoryB);
}

const validTypes = ['feature', 'action', 'bloodied', 'lastStand'];
const { monsterFeatureTypes } = CONFIG.NIMBLE;

function filterMonsterFeatures(actor, searchTerm) {
	return actor.items.filter((item) => {
		if (!validTypes.includes(item.system?.subtype)) return false;

		if (!searchTerm) return true;
		return item.name.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase());
	});
}

function mapMonsterFeatureToType(item) {
	return item.system?.subtype || 'feature';
}

function prepareItemTooltip(item) {
	switch (item.type) {
		case 'monsterFeature':
			return prepareMonsterFeatureTooltip(item);
		default:
			return null;
	}
}

function getFeatureMetadata(item) {
	return null;
}

function getMonsterFeatureIcon(categoryName) {
	switch (categoryName) {
		case 'bloodied':
			return 'fa-solid fa-droplet';
		case 'last stand':
			return 'fa-solid fa-skull';
		case 'action':
			return 'fa-solid fa-bolt';
		default:
			return 'fa-solid fa-message';
	}
}
function getArmorClassLabel(armor) {
	return npcArmorTypeAbbreviations[armor] ?? '-';
}

function handleEditorSave(event, updatePath, editState) {
	const target = event.target;

	if (!target) return;
	if (target.dataset?.action !== 'save') return;

	const editor = target.parentNode.closest(`[name="${updatePath}"]`);

	if (editor?.dataset?.documentUUID !== actor.uuid) return;

	bloodiedEffectInEditMode = false;
	lastStandEffectInEditMode = false;
	attackSequenceInEditMode = false;
}

function updateArmorCategory(direction) {
	const armor = actor.reactive.system.attributes.armor;

	if (direction === 'increase') {
		if (armor === 'heavy') return;

		if (armor === 'medium') {
			actor.update({ 'system.attributes.armor': 'heavy' });
		} else {
			actor.update({ 'system.attributes.armor': 'medium' });
		}
	} else if (direction === 'decrease') {
		if (armor === 'heavy') {
			actor.update({ 'system.attributes.armor': 'medium' });
		} else if (armor === 'medium') {
			actor.update({ 'system.attributes.armor': 'none' });
		}
	}
}

const { npcArmorTypeAbbreviations } = CONFIG.NIMBLE;

let actor = getContext('actor');

let features = $derived.by(() =>
	actor.reactive.items.filter((item) => !item.reactive.system.isAction),
);

let actions = $derived.by(() =>
	actor.reactive.items.filter((item) => item.reactive.system.isAction),
);

let bloodiedEffectInEditMode = $state(false);
let lastStandEffectInEditMode = $state(false);
let attackSequenceInEditMode = $state(false);

let searchTerm = $state('');
let items = $derived(filterMonsterFeatures(actor.reactive, searchTerm));
let categorizedItems = $derived(groupItemsByType(items));

let flags = $derived(actor.reactive.flags.nimble);
let showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);

document.addEventListener('click', (event) =>
	handleEditorSave(event, 'system.attackSequence', attackSequenceInEditMode),
);

onDestroy(() => {
	document.removeEventListener('click', handleEditorSave);
});
</script>

<section class="nimble-sheet__body nimble-sheet__body--npc">
    <section class="nimble-monster-sheet-section nimble-monster-sheet-section--defences">
        <SavingThrows characterSavingThrows={actor.reactive.system.savingThrows} />

        <section class="nimble-other-attribute-wrapper" style="grid-area: armor;">
            <header class="nimble-section-header" data-header-alignment="center">
                <h3
                    class="nimble-heading"
                    data-heading-variant="section"
                >
                    Armor
                </h3>
            </header>

            <ArmorClass armorClass={getArmorClassLabel(actor.reactive.system.attributes.armor)} />

            <button
                class="nimble-button nimble-armor-config-button nimble-armor-config-button--decrement"
                data-button-variant="basic"
                type="button"
                aria-label="Decrease Armor"
                data-tooltip="Decrease Armor"
                disabled={actor.reactive.system.armor === 'none'}
                onclick={() => updateArmorCategory("decrease")}
            >
                -
            </button>

            <button
                class="nimble-button nimble-armor-config-button nimble-armor-config-button--increment"
                data-button-variant="basic"
                type="button"
                aria-label="Increase Armor"
                data-tooltip="Increase Armor"
                disabled={actor.reactive.system.armor === 'heavy'}
                onclick={() =>updateArmorCategory("increase")}
            >
                +
            </button>
        </section>
    </section>
	<header class="nimble-sheet__static nimble-sheet__static--features">
		<div class="nimble-search-wrapper">
			<SearchBar bind:searchTerm />

			<button
				class="nimble-button fa-solid fa-plus"
				data-button-variant="basic"
				type="button"
				aria-label="Create Feature"
				data-tooltip="Create Feature"
				onclick={createItem}
			></button>
		</div>
	</header>
	<section class="nimble-sheet__body nimble-sheet__body--player-character">
		{#each Object.entries(categorizedItems).sort(sortItemCategories) as [categoryName, itemCategory]}
			<div>
				<header>
					<h3 class="nimble-heading" data-heading-variant="section">
						{monsterFeatureTypes[categoryName] ?? categoryName}
					</h3>
				</header>
				{#if (categoryName === "action" && actor.reactive.type === "soloMonster")}
					{#if attackSequenceInEditMode}
						{#key actor.reactive.system.attackSequence}
							<Editor
								editorOptions={{ compact: true, toggled: false, height: 80 }}
								field="system.attackSequence"
								content={actor.reactive.system.attackSequence || "After each hero's turn, choose one."}
								document={actor}
							/>
						{/key}
					{:else}
						<div class="nimble-monster-feature-text-with-button" style="display: flex; align-items: center; gap: 0.5rem;">
							{#await TextEditor.enrichHTML(actor.reactive?.system?.attackSequence || "After each hero's turn, choose one.") then hintText}
								{#if hintText}
									<div class="nimble-monster-feature-text">
										{@html hintText}
									</div>
								{/if}
							{/await}
							{#if !attackSequenceInEditMode}
								{#key actor.reactive.system.attackSequence}
									<button
										class="nimble-button nimble-monster-feature-edit-button"
										data-button-variant="icon"
										type="button"
										aria-label="Edit"
										data-tooltip="Edit"
										onclick={() => (attackSequenceInEditMode = true)}
									>
										<i class="fa-solid fa-edit"></i>
									</button>
								{/key}
							{/if}
						</div>
					{/if}
				{/if}

				<ul class="nimble-item-list">
					{#each sortItems(itemCategory) as item (item.reactive._id)}
						{@const metadata = getFeatureMetadata(item)}
						<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role  -->
						<!-- svelte-ignore  a11y_click_events_have_key_events -->
						<li class="nimble-document-card nimble-document-card--no-meta"
							class:nimble-document-card--no-image={!showEmbeddedDocumentImages}
							class:nimble-document-card--no-meta={!metadata}
							data-item-id={item.reactive._id}
							data-tooltip={prepareItemTooltip(item)}
							data-tooltip-class="nimble-tooltip nimble-tooltip--item"
							data-tooltip-direction="LEFT"
							draggable="true"
							role="button"
							ondragstart={(event) => sheet._onDragStart(event)}
							onclick={() => actor.activateItem(item.reactive._id)}
						>
							<header class="u-semantic-only">
								{#if showEmbeddedDocumentImages}
									<img class="nimble-document-card__img"
										src={item.reactive.img}
										alt={item.reactive.name} />
								{/if}

								<h4 class="nimble-document-card__name nimble-heading"
									data-heading-variant="item">
									{item.reactive.name}
								</h4>

								<button
									class="nimble-button"
									data-button-variant="icon"
									type="button"
									aria-label="Configure {item.reactive.name}"
									onclick={(event) =>
										configureItem(event, item._id)}
								>
									<i class="fa-solid fa-edit"></i>
								</button>

								<button
									class="nimble-button"
									data-button-variant="icon"
									type="button"
									aria-label="Delete {item.reactive.name}"
									onclick={(event) => deleteItem(event, item._id)}
								>
									<i class="fa-solid fa-trash"></i>
								</button>
							</header>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</section>
<!--
    {#if actor.type === "soloMonster"}
        <section class="nimble-monster-sheet-section">
            <ol class="nimble-monster-list">
                <li class="u-semantic-only">
                    <article class="nimble-monster-list__item">
                        <header class="nimble-section-header">
                            <button
                                class="nimble-u-unstyled-button"
                                onclick={() => actor.activateBloodiedFeature()}
                            >
                                <h4 class="nimble-heading" data-heading-variant="item">
                                    <i
                                        class="nimble-heading__icon nimble-heading__icon--activation nimble-monster-heading__icon--bloodied fa-solid fa-droplet"
                                    ></i>

                                    Bloodied
                                </h4>
                            </button>

                            {#if !bloodiedEffectInEditMode}
                                <button
                                    class="nimble-button"
                                    data-button-variant="icon"
                                    type="button"
                                    aria-label="Edit"
                                    data-tooltip="Edit"
                                    onclick={() => (bloodiedEffectInEditMode = true)}
                                >
                                    <i class="fa-solid fa-edit"></i>
                                </button>
                            {/if}
                        </header>

                        {#if bloodiedEffectInEditMode}
                            {#key actor.reactive.system.bloodiedEffect.description}
                                <Editor
                                    editorOptions={{ compact: true, toggled: false, height: 100 }}
                                    field="system.bloodiedEffect.description"
                                    content={actor.reactive.system.bloodiedEffect.description}
                                    document={actor}
                                />
                            {/key}
                        {:else}
                            {#await TextEditor.enrichHTML(actor.reactive?.system?.bloodiedEffect?.description) then bloodiedDescription}
                                {#if bloodiedDescription}
                                    <div class="nimble-monster-feature-text">
                                        {@html bloodiedDescription}
                                    </div>
                                {/if}
                            {/await}
                        {/if}
                    </article>
                </li>

                <li>
                    <article class="nimble-monster-list__item">
                        <header class="nimble-section-header">
                            <button
                                class="nimble-u-unstyled-button"
                                onclick={() => actor.activateLastStandFeature()}
                            >
                                <h4 class="nimble-heading" data-heading-variant="item">
                                    <i
                                        class="nimble-heading__icon nimble-heading__icon--activation nimble-monster-heading__icon--last-stand fa-solid fa-skull"
                                    ></i>

                                    Last Stand
                                </h4>
                            </button>

                            {#if !lastStandEffectInEditMode}
                                <button
                                    class="nimble-button"
                                    data-button-variant="icon"
                                    type="button"
                                    aria-label="Edit"
                                    data-tooltip="Edit"
                                    onclick={() => (lastStandEffectInEditMode = true)}
                                >
                                    <i class="fa-solid fa-edit"></i>
                                </button>
                            {/if}
                        </header>

                        {#if lastStandEffectInEditMode}
                            {#key actor.reactive.system.lastStandEffect.description}
                                <Editor
                                    editorOptions={{ compact: true, toggled: false, height: 100 }}
                                    field="system.lastStandEffect.description"
                                    content={actor.reactive.system.lastStandEffect.description}
                                    document={actor}
                                />
                            {/key}
                        {:else}
                            {#await TextEditor.enrichHTML(actor.reactive?.system?.lastStandEffect.description) then lastStandDescription}
                                {#if lastStandDescription}
                                    <div class="nimble-monster-feature-text">
                                        {@html lastStandDescription}
                                    </div>
                                {/if}
                            {/await}
                        {/if}
                    </article>
                </li>
            </ol>
        </section>
    {/if}
-->
</section>

<style lang="scss">

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
    .nimble-other-attribute-wrapper {
        position: relative;

        &:hover .nimble-armor-config-button {
            --nimble-button-display: flex;
        }
    }

    .nimble-armor-config-button {
        --nimble-button-display: none;
        --nimble-button-padding: 0;
        --nimble-button-width: 0.75rem;

        position: absolute;
        bottom: 0;
        width: 0.5rem;
        height: 0.5rem;
        padding: 0;
        line-height: 1;
        border: none;
        background-color: transparent;
        cursor: pointer;
        font-size: var(--nimble-sm-text);
        color: var(--nimble-text-color);
        transition: color 0.2s ease-in-out;

        &--decrement {
            left: 0.25rem;
        }

        &--increment {
            right: 0.25rem;
        }

        &:hover {
            color: var(--nimble-primary-color);
        }
    }

    .nimble-monster-sheet-section {
        padding: 0.5rem;

        &--defences {
            display: grid;
            grid-template-columns: 1fr 4.2rem;
            grid-template-areas: "savingThrows armor";
        }

        &:not(:last-of-type) {
            border-bottom: 1px solid hsl(41, 18%, 54%, 25%);
        }
    }
</style>
