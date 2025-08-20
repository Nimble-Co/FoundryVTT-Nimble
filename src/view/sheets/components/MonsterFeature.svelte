<script>
import { getContext } from 'svelte';

let { icon = 'fa-solid fa-message', item } = $props();

let actor = getContext('actor');
let hasUses = false;
</script>

<li class="u-semantic-only">
    <article class="nimble-monster-list__item">
        <header class="nimble-section-header">
            <button
                class="nimble-u-unstyled-button"
                onclick={() => actor.activateItem(item._id)}
            >
                <h4 class="nimble-heading" data-heading-variant="item">
                    <i
                        class="nimble-heading__icon nimble-heading__icon--activation {icon}"
                    ></i>

                    {item.reactive.name}
                </h4>
            </button>

            {#if hasUses}
                <div class="nimble-heading-input-wrapper">
                    <input class="nimble-heading-input" type="number" />
                    /
                    <input class="nimble-heading-input" type="number" />
                </div>
            {/if}

            <button
                class="nimble-button"
                data-button-variant="icon"
                type="button"
                aria-label="Edit"
                data-tooltip="Edit"
                onclick={() => actor.configureItem(item._id)}
            >
                <i class="fa-solid fa-edit"></i>
            </button>

            <button
                class="nimble-button"
                data-button-variant="icon"
                type="button"
                aria-label="Delete"
                data-tooltip="Delete"
                onclick={() => actor.deleteItem(item._id)}
            >
                <i class="fa-solid fa-trash"></i>
            </button>
        </header>

        <div class="nimble-monster-feature-text">
            {#await foundry.applications.ux.TextEditor.implementation.enrichHTML(item?.reactive?.system?.description ?? "") then description}
                {@html description}
            {/await}
        </div>
    </article>
</li>

<style class="scss">
    .nimble-heading-input-wrapper {
        display: flex;
        gap: 0.25rem;
    }

    [type="number"].nimble-heading-input {
        height: auto;
        width: 4ch;
        padding: 0;
        font-size: var(--nimble-sm-text);
        font-weight: 500;
        line-height: 1;
        text-align: center;
        border: 0;
        border-radius: 4px;
        background: transparent;

        &:active,
        &:focus {
            background-color: hsla(41, 18%, 54%, 0.15);
            border: 0;
            outline: 0;
            box-shadow: none;
        }

        &:hover {
            border: 0;
            background-color: hsla(41, 18%, 54%, 0.15);
        }
    }

    .nimble-monster-list__item {
        --nimble-button-font-size: var(--nimble-sm-text);
        --nimble-button-opacity: 0;
        --nimble-button-padding: 0;
        --nimble-button-icon-y-nudge: -1px;

        &:hover {
            --nimble-button-opacity: 1;
        }
    }
</style>
