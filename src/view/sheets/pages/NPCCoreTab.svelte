<script lang="ts">
import { FALSE, TRUE } from 'sass';
import { getContext, onDestroy } from 'svelte';
import sortItems from '../../../utils/sortItems.js';
import ArmorClass from '../components/ArmorClass.svelte';
import Editor from '../components/Editor.svelte';
import MonsterFeature from '../components/MonsterFeature.svelte';
import MovementSpeed from '../components/MovementSpeed.svelte';
import SavingThrows from '../components/SavingThrows.svelte';

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

function filterMonsterFeatures(actor) {
	return actor.items.filter((item) => {
		if (!validTypes.includes(item.system?.subtype)) return false;

		return item.name.toLocaleLowerCase();
	});
}

function mapMonsterFeatureToType(item) {
	return item.system?.subtype || 'feature';
}

function prepareItemTooltip(item) {
	return null;
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

async function handleDrop(event, targetId) {
	const draggedId = event.dataTransfer.getData('nimble/reorder');
	if (!draggedId) return;

	event.preventDefault();

	const draggedItem = actor.items.get(draggedId);
	const targetItem = actor.items.get(targetId);
	if (!draggedItem || !targetItem) return;

	const draggedCategory = mapMonsterFeatureToType(draggedItem);
	const targetCategory = mapMonsterFeatureToType(targetItem);
	if (draggedCategory !== targetCategory) return;

	const categoryItems = categorizedItems[draggedCategory];
	const draggedIndex = categoryItems.findIndex((item) => item._id === draggedId);
	const targetIndex = categoryItems.findIndex((item) => item._id === targetId);
	if (draggedIndex === -1 || targetIndex === -1) return;

	const newItems = [...categoryItems];
	newItems.splice(draggedIndex, 1);
	newItems.splice(targetIndex, 0, draggedItem);

	const updates = newItems.map((item, index) => ({ _id: item._id, sort: index * 10000 }));
	await actor.updateEmbeddedDocuments('Item', updates);
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

let items = $derived(filterMonsterFeatures(actor.reactive));
let categorizedItems = $derived(groupItemsByType(items));

let flags = $derived(actor.reactive.flags.nimble);
let showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);

let allCollapsed = $derived(items.every(item => item.reactive.flags.nimble?.collapsed ?? true));

document.addEventListener('click', (event) =>
	handleEditorSave(event, 'system.attackSequence', attackSequenceInEditMode),
);

onDestroy(() => {
	document.removeEventListener('click', handleEditorSave);
});
</script>

<section class="nimble-sheet__body nimble-sheet__body--npc">
    <section class="nimble-monster-sheet-section nimble-monster-sheet-section--defenses">
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
		<h4 class="nimble-heading" data-heading-variant="section">
			Features
			<button
				class="nimble-button fa-solid fa-plus"
				data-button-variant="basic"
				type="button"
				aria-label="Create Feature"
				data-tooltip="Create Feature"
				onclick={createItem}
			></button>
			<button
				class="nimble-button"
				style="margin-left: auto;"
				data-button-variant="basic"
				type="button"
				aria-label={allCollapsed ? "Expand all descriptions" : "Collapse all descriptions"}
				data-tooltip={allCollapsed ? "Expand all descriptions" : "Collapse all descriptions"}
				onclick={() => {
					const newState = !allCollapsed;
					items.forEach(item => item.update({ 'flags.nimble.collapsed': newState }));
				}}
			>
				<i class="fa-solid {allCollapsed ? 'fa-expand' : 'fa-compress'}"></i>
			</button>
		</h4>
	</header>

	{#if Object.entries(categorizedItems).length > 0}
	<section class="nimble-sheet__body nimble-sheet__body--player-character">

		{#each Object.entries(categorizedItems).sort(sortItemCategories) as [categoryName, itemCategory]}
			<section class="nimble-monster-sheet-section">
				{#if categoryName != "feature"}
					<header>
						<h4 class="nimble-heading" data-heading-variant="section">
							{monsterFeatureTypes[categoryName] ?? categoryName}
						</h4>
					</header>
				{/if}
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

				<ul class="nimble-item-list" ondragover={(event) => { if (event.dataTransfer.types.includes('nimble/reorder')) event.preventDefault(); }}>
					{#each sortItems(itemCategory) as item (item.reactive._id)}
						{@const metadata = getFeatureMetadata(item)}
						{@const isCollapsed = item.reactive.flags.nimble?.collapsed ?? false}
						<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role  -->
						<!-- svelte-ignore  a11y_click_events_have_key_events -->
						<li class="nimble-document-card nimble-document-card--no-meta nimble-document-card--monster-sheet"
							class:nimble-document-card--no-image={!showEmbeddedDocumentImages}
							class:nimble-document-card--no-meta={!metadata}
							data-item-id={item.reactive._id}
							data-tooltip={prepareItemTooltip(item)}
							data-tooltip-class="nimble-tooltip nimble-tooltip--item"
							data-tooltip-direction="LEFT"
							draggable="true"
							role="button"
							ondragstart={(event) => { event.dataTransfer.setData('nimble/reorder', item._id); sheet._onDragStart(event); }}
							ondrop={(event) => handleDrop(event, item._id)}
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

								{#if !isCollapsed}
									<button
										class="nimble-button"
										data-button-variant="icon"
										type="button"
										aria-label="Collapse description for {item.reactive.name}"
										onclick={(event) => { event.stopPropagation(); item.update({ 'flags.nimble.collapsed': true }); }}
									>
										<i class="fa-solid fa-chevron-up"></i>
									</button>
								{:else}
									<button
										class="nimble-button"
										data-button-variant="icon"
										type="button"
										aria-label="Reveal description for {item.reactive.name}"
										onclick={(event) => { event.stopPropagation(); item.update({ 'flags.nimble.collapsed': false }); }}
									>
										<i class="fa-solid fa-chevron-down"></i>
									</button>
								{/if}

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
						{#if !isCollapsed}
							<div class="nimble-monster-feature-text" style="display: flex; align-items: center; gap: 0.5rem;">
								{#await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description) then featureDescription}
									{#if featureDescription}
										<div class="nimble-monster-feature-text">
											{@html featureDescription}
										</div>
									{/if}
								{/await}
							</div>
						{/if}
					{/each}
				</ul>
			</section>
		{/each}
	</section>
	{/if}
	<section class="nimble-monster-sheet-section">
		<MovementSpeed {actor} showDefaultSpeed={false} />
	</section>
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

        &--defenses {
            display: grid;
            grid-template-columns: 1fr 4.2rem;
            grid-template-areas: "savingThrows armor";
        }

        &:not(:last-of-type) {
            border-bottom: 1px solid hsl(41, 18%, 54%, 25%);
        }
    }
</style>
