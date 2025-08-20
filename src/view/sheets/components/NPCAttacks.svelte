<script>
import { getContext, onDestroy } from 'svelte';

import Editor from './Editor.svelte';
import MonsterFeature from './MonsterFeature.svelte';

function handleEditorSave(event) {
	const target = event.target;

	if (!target) return;
	if (target.dataset?.action !== 'save') return;

	const editor = target.parentNode.closest('[name="system.attackSequence"]');

	if (editor?.dataset?.documentUUID !== actor.uuid) return;

	attackSequenceInEditMode = false;
}

let { attacks } = $props();

let actor = getContext('actor');
let actorData = getContext('actorData');

let attackSequenceInEditMode = $state(false);

document.addEventListener('click', handleEditorSave);

onDestroy(() => {
	document.removeEventListener('click', handleEditorSave);
});
</script>

<li class="u-semantic-only">
    <article class="nimble-monster-list__item">
        <header class="nimble-section-header">
            <h4
                class="nimble-heading"
                data-heading-variant="item"
                style="cursor: default;"
            >
                Attack
            </h4>

            {#if !attackSequenceInEditMode}
                <button
                    class="nimble-button"
                    data-button-variant="icon"
                    type="button"
                    aria-label="Edit"
                    data-tooltip="Edit"
                    onclick={() => (attackSequenceInEditMode = true)}
                >
                    <i class="fa-solid fa-edit"></i>
                </button>
            {/if}
        </header>

        {#if attackSequenceInEditMode}
            <Editor
                editorOptions={{ compact: true, toggled: false, height: 100 }}
                field="system.attackSequence"
                content={actor.reactive.system.attackSequence}
                document={actor}
            />
        {:else}
            {#await foundry.applications.ux.TextEditor.implementation.enrichHTML(actor.reactive.system?.attackSequence) then attackSequence}
                {#if attackSequence}
                    <div class="nimble-monster-feature-text">
                        {@html attackSequence}
                    </div>
                {/if}
            {/await}
        {/if}
    </article>
</li>

{#if attacks.length}
    <ul class="nimble-monster-list nimble-monster-list--sublist">
        {#each attacks as item (item._id)}
            <MonsterFeature {item} icon="fa-solid fa-dice" />
        {/each}
    </ul>
{/if}

<style lang="scss">
    .nimble-monster-list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        list-style: none;
        padding: 0;

        &--sublist {
            margin: 0 0 0 0.75rem;
        }
    }

    .nimble-section-header {
        --nimble-button-font-size: var(--nimble-sm-text);
        --nimble-button-opacity: 0;
        --nimble-button-padding: 0;
        --nimble-button-icon-y-nudge: -1px;

        &:hover {
            --nimble-button-opacity: 1;
        }
    }
</style>
