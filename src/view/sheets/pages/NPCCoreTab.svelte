<script>
import { getContext, onDestroy } from 'svelte';

import ArmorClass from '../components/ArmorClass.svelte';
import Editor from '../components/Editor.svelte';
import MonsterFeature from '../components/MonsterFeature.svelte';
import NPCAttacks from '../components/NPCAttacks.svelte';
import SavingThrows from '../components/SavingThrows.svelte';

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
	actor.reactive.items.filter(
		(item) => item.reactive.system.isAction && !item.reactive.system.isAttack,
	),
);

let attacks = $derived.by(() =>
	actor.reactive.items.filter(
		(item) => item.reactive.system.isAction && item.reactive.system.isAttack,
	),
);

let bloodiedEffectInEditMode = $state(false);
let lastStandEffectInEditMode = $state(false);

document.addEventListener('click', (event) =>
	handleEditorSave(event, 'system.bloodiedEffect.description', bloodiedEffectInEditMode),
);

document.addEventListener('click', (event) =>
	handleEditorSave(event, 'system.lastStandEffect.description', lastStandEffectInEditMode),
);

onDestroy(() => {
	document.removeEventListener('click', handleEditorSave);
	document.removeEventListener('click', handleEditorSave);
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

    <section class="nimble-monster-sheet-section">
        <header class="nimble-section-header" data-header-variant="monster-actions">
            <h4 class="nimble-heading" data-heading-variant="section">
                Features
            </h4>

            <button
                class="nimble-button"
                data-button-variant="icon"
                type="button"
                data-tooltip="Create New Feature"
                aria-label="Create New Feature"
                onclick={() =>
                    actor.createItem({ name: "New Feature", type: "monsterFeature" })}
            >
                <i class="fa-solid fa-square-plus"></i>
            </button>
        </header>

        <ul class="nimble-monster-list">
            {#each features as item (item._id)}
                <MonsterFeature {item} />
            {/each}
        </ul>
    </section>

    <section class="nimble-monster-sheet-section">
        <header class="nimble-section-header" data-header-variant="monster-actions">
            <h4 class="nimble-heading" data-heading-variant="section">
                Actions

                {#if actor.reactive.type === "soloMonster"}
                    <i
                        class="nimble-monster-heading__icon fa-solid fa-circle-question"
                        data-tooltip="After each hero's turn, choose one."
                    ></i>
                {/if}
            </h4>

            <button
                class="nimble-button"
                data-button-variant="icon"
                aria-label="Create New Feature"
                data-tooltip="Create New Feature"
                onclick={() =>
                    actor.createItem({
                        name: "New Feature",
                        type: "monsterFeature",
                        system: { isAction: true },
                    })}
            >
                <i class="fa-solid fa-square-plus"></i>
            </button>
        </header>

        <ul class="nimble-monster-list">
            {#each actions as item (item._id)}
                <MonsterFeature {item} />
            {/each}

            <NPCAttacks {attacks} />
        </ul>
    </section>

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
                            {#await foundry.applications.ux.TextEditor.implementation.enrichHTML(actor.reactive?.system?.bloodiedEffect?.description) then bloodiedDescription}
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
                            {#await foundry.applications.ux.TextEditor.implementation.enrichHTML(actor.reactive?.system?.lastStandEffect.description) then lastStandDescription}
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
</section>

<style lang="scss">
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

    .nimble-monster-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        list-style: none;
        margin: 0;
        padding: 0;

        &__item {
            --nimble-button-font-size: var(--nimble-sm-text);
            --nimble-button-opacity: 0;
            --nimble-button-padding: 0;
            --nimble-button-icon-y-nudge: -1px;

            &:hover {
                --nimble-button-opacity: 1;
            }
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

    .nimble-monster-heading__icon {
        color: inherit;
        font-size: var(--nimble-sm-text);
        transform: translateY(-1px);
        opacity: 0.65;

        &--bloodied,
        &--last-stand {
            color: var(--nimble-dark-text-color);
            font-size: var(--nimble-xs-text);
            margin-inline-end: 0.125rem;
            cursor: inherit;
        }
    }
</style>
